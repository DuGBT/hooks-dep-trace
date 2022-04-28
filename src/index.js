const fs = require("fs/promises");
const path = require("path");
const espree = require("espree");
const esquery = require("esquery");
const tsParser = require("@typescript-eslint/typescript-estree");

const callExpressionSelector = esquery.parse(`[type=CallExpression]`);

const config = {
    jsx: true,
    sourseType: "module",
};
const parseOption = {
    sourceType: "module",
    ecmaVersion: 2022,
    ecmaFeatures: {
        jsx: true,
        globalReturn: false,
        impliedStrict: false,
    },
};

function isReactComponent(statement) {
    let name;
    if (statement.type === "VariableDeclaration") {
        name = statement.declarations[0].id.name;
    } else if (
        statement.type === "ExportDefaultDeclaration" &&
        statement.declaration.type === "FunctionDeclaration"
    ) {
        name = statement.declaration.id.name;
    } else name = statement.id.name;
    return name[0] === name[0].toUpperCase();
}

function getComponentDeclaration(Node) {
    if (Node.type === "FunctionDeclaration") {
        return Node.body.body;
    }
    if (Node.type === "VariableDeclaration") {
        const initNode = Node.declarations[0].init;
        if (initNode?.type === "ArrowFunctionExpression")
            return initNode.body.body;
        if (initNode?.type === "CallExpression") {
            return initNode.arguments[0]?.body?.body;
        }
    }
    if (Node.type === "ExportDefaultDeclaration") {
        return (
            Node.declaration.type === "FunctionDeclaration" &&
            Node.declaration.body.body
        );
    }
}

function useEffectFilter(Node) {
    return (
        Node.type === "ExpressionStatement" &&
        Node.expression.type === "CallExpression" &&
        (Node.expression.callee.name === "useEffect" ||
            Node.expression.callee.name === "useLayoutEffect")
    );
}

function addFunctionToMap(name, body, map) {
    if (map[name]) {
        throw Error(`duplicated function ${name}`);
    } else {
        map[name] = body;
    }
}

function findUseCallBackBlockStatement(Node) {
    const selector = esquery.parse("[type='BlockStatement']");
    const blockStatements = esquery.match(Node, selector);
    return blockStatements[0];
}

function getAllFunctionDeclarations(Node, functionMap) {
    let functionName, functionBody;
    if (Node.type === "FunctionDeclaration") {
        functionName = Node.id.name;
        functionBody = Node.body;
    }
    const initNode = Node.declarations?.[0]?.init;
    if (
        Node.type === "VariableDeclaration" &&
        initNode?.type === "ArrowFunctionExpression"
    ) {
        functionName = Node.declarations[0].id.name;
        functionBody = initNode.body;
    }
    const isUseCallback = initNode?.callee?.name === "useCallback";
    if (isUseCallback) {
        functionName = Node.declarations[0].id.name;
        functionBody = findUseCallBackBlockStatement(Node);
    }
    if (functionName) {
        addFunctionToMap(functionName, functionBody, functionMap);
    }
}

function parseMemberExpression(Node) {
    if (Node.type !== "MemberExpression") {
        return Node.name;
    }
    return parseMemberExpression(Node.object) + "." + Node.property.name;
}

function findSetStateCallInRecursion(functionMap, Node, effectList) {
    const callNodes = esquery.match(Node, callExpressionSelector);

    const callExpressionList = [
        ...new Set(
            callNodes.map((Node) => {
                return Node.callee.name || Node.callee.property.name;
            })
        ),
    ];

    callExpressionList.forEach((name) => {
        if (
            name.startsWith("set") &&
            name !== "setTimeout" &&
            name !== "setInterval"
        ) {
            effectList.add(name);
        }
        if (!functionMap[name]) {
            return;
        }
        findSetStateCallInRecursion(functionMap, functionMap[name], effectList);
    });
}

function findAllSetStateCall(functionMap, effectHooks, result) {
    effectHooks.forEach((Node) => {
        const effectList = new Set();
        const hooksArguments = Node.expression.arguments;
        let dependenceStates;
        if (hooksArguments.length === 2)
            dependenceStates = hooksArguments[1].elements.map((Node) => {
                if (Node.type === "MemberExpression") {
                    return parseMemberExpression(Node);
                }
                return Node.name;
            });
        else dependenceStates = undefined;
        const functionNodeInEffect = hooksArguments[0];
        findSetStateCallInRecursion(
            functionMap,
            functionNodeInEffect,
            effectList
        );
        result.set(dependenceStates, [...effectList]);
    });
}
function getComponentName(Node) {
    if (Node.type === "VariableDeclaration") {
        return Node.declarations[0].id.name;
    }
    if (Node.type === "FunctionDeclaration") {
        return Node.id.name;
    }
    if (Node.type === "ExportDefaultDeclaration") {
        return (
            Node.declaration.type === "FunctionDeclaration" &&
            Node.declaration.id.name
        );
    }
}

async function getCodeAst(filePath) {
    const code = (await fs.readFile(filePath)).toString();
    if (filePath.indexOf(".js") !== -1) return espree.parse(code, parseOption);
    return tsParser.parse(code, config);
}
async function main(options) {
    const { filePath, save } = options;
    const ast = await getCodeAst(filePath);
    const topLevelFunctions = ast.body.filter(
        (node) =>
            node.type === "VariableDeclaration" ||
            node.type === "FunctionDeclaration" ||
            node.type === "ExportDefaultDeclaration"
    );
    const hooksResult = {};
    try {
        topLevelFunctions.forEach((Node) => {
            const topLevelFunction = getComponentDeclaration(Node);
            if (!topLevelFunction) return;

            const componentName = getComponentName(Node);
            const functionMap = {};
            const effectCallMap = new Map();

            Array.from(topLevelFunction).forEach((Node) => {
                getAllFunctionDeclarations(Node, functionMap);
            });

            const useEffectdeclarations =
                topLevelFunction.filter(useEffectFilter);
            const isComponent = isReactComponent(Node);
            findAllSetStateCall(
                functionMap,
                useEffectdeclarations,
                effectCallMap
            );
            const effectMap = Array.from(effectCallMap.entries()).reduce(
                (effectJSONObject, current, currentIndex) => {
                    const [dependencies, effectCall] = current;
                    const effectIndex = "effect" + (currentIndex + 1);
                    effectJSONObject[effectIndex] = {
                        dependencies,
                        effectCall,
                    };
                    return effectJSONObject;
                },
                {}
            );
            if (isComponent) hooksResult[componentName] = effectMap;
            if (!save && Object.keys(effectMap).length > 0)
                console.log(effectMap);
        });
        if (save) {
            const targetPath = path.join(
                path.dirname(filePath),
                path.basename(filePath) + "-hooks-trace-result.json"
            );
            await fs.rm(targetPath).catch(() => {});
            await fs.appendFile(targetPath, JSON.stringify(hooksResult));
            console.log("save result in " + targetPath + " success");
        } else console.log("handle " + filePath, "success");
    } catch (error) {
        console.log("handle " + filePath + " error:", error);
    }
    // todo 支持检查自定义Hooks？
}
module.exports = {
    main,
    addFunctionToMap,
    isReactComponent,
    getComponentDeclaration,
    getComponentName,
    getAllFunctionDeclarations,
    getCodeAst,
    useEffectFilter,
    findAllSetStateCall,
};
