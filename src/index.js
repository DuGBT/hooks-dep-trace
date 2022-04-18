import fs from "fs";
import * as espree from "espree";
import esquery from "esquery";
const fileContent = fs
    .readFileSync("../_source_code/multiFacts.js")
    .toString();

const parseOption = {
    sourceType: "module",
    ecmaVersion: 2022,
    ecmaFeatures: {
        jsx: true,
        globalReturn: false,
        impliedStrict: false,
    },
};

const callExpressionSelector = esquery.parse(`[type=CallExpression]`);

function getComponentDeclaration(Node) {
    if (Node.type === "FunctionDeclaration") {
        return Node.body.body;
    }
    if (Node.type === "VariableDeclaration") {
        const initNode = Node.declarations[0].init;
        if (initNode.type === "ArrowFunctionExpression")
            return initNode.body.body;
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
function getAllFunctionDeclarations(Node, functionMap) {
    let functionName, functionBody;
    if (Node.type === "FunctionDeclaration") {
        functionName = Node.id.name;
        functionBody = Node.body;
    } else if (
        Node.type === "VariableDeclaration" &&
        Node.declarations[0]?.init?.type === "ArrowFunctionExpression"
    ) {
        functionName = Node.declarations[0].id.name;
        functionBody = Node.declarations[0].init.body;
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

function addEffectAndDependency(effectNodes, dependenceNodes) {
    if (!effectNodes.length || !dependenceNodes.length) {
        return;
    }
    const dependenceStateList = dependenceNodes.map((Node) => Node.name);
    const effectList = effectNodes.map((Node) => Node.callee.name);
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
        if (name.startsWith("set")) {
            effectList.add(name);
        }
        if (!functionMap[name]) {
            return;
        }
        findSetStateCallInRecursion(functionMap, functionMap[name], effectList);
    });
}

function findAllSetStateCall(functionMap, effectHooks) {
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
        console.log(dependenceStates, [...effectList]);
    });
}

function useStateFilter(Node) {
    return (
        Node.type === "VariableDeclaration" &&
        Node.declarations[0].init?.type === "CallExpression" &&
        Node.declarations[0].init?.callee?.name === "useState"
    );
}

function getUseStateDeclarations(Node) {
    const { elements } = Node.declarations[0].id;
    return [elements[0].name, elements[1].name];
}
function findEffectInFunction(name, Node, effectFunctionMap) {
    const Nodes = esquery.match(Node, callExpressionSelector);
    const callExpressionList = Nodes.flatMap((Node) => {
        if (!Node.callee.name) {
            return [];
        } else return [Node.callee.name];
    });
    if (!callExpressionList.length) {
        return;
    }
    callExpressionList.forEach((functionName) => {
        if (functionName.startsWith("set")) {
            if (!effectFunctionMap[name]) {
                effectFunctionMap[name] = [functionName];
            } else effectFunctionMap[name].push(functionName);
        }
    });
}

function findEffectInFunctionMap(functionMap, effectFunctionMap) {
    Object.entries(functionMap).forEach(([name, Node]) => {
        findEffectInFunction(name, Node, effectFunctionMap);
    });
}

const topLevelFunctionBodys = espree
    .parse(fileContent, parseOption)
    .body.filter(
        (node) =>
            node.type === "VariableDeclaration" ||
            node.type === "FunctionDeclaration"
    )
    .map(getComponentDeclaration);
topLevelFunctionBodys.forEach((topLevelFunction) => {
    if (!topLevelFunction) return;
    const functionMap = {};
    const stateHooks = [];
    const effectHooks = [];
    const effectFunctionMap = {};
    const setStateCallMap = {};

    topLevelFunction.forEach((Node) => {
        getAllFunctionDeclarations(Node, functionMap);
    });

    Object.keys(functionMap).forEach((functionName) => {
        setStateCallMap[functionName] = {};
    });
    const useStateDeclarationAst = topLevelFunction.filter(useStateFilter);
    const useEffectdeclarationAst = topLevelFunction.filter(useEffectFilter);
    const useStateDeclarations = useStateDeclarationAst.map(
        getUseStateDeclarations
    );

    for (const declaration of useStateDeclarations) {
        stateHooks.push(declaration);
    }
    for (const declaration of useEffectdeclarationAst) {
        effectHooks.push(declaration);
    }
    findAllSetStateCall(functionMap, effectHooks);
    findEffectInFunctionMap(functionMap, effectFunctionMap);
    console.log("------------");
});
//todo 圈复杂度提示 effect自动转箭头函数配置 useCallback返回函数检查 forwardRef转发组件检查 setTimeout和setInterval排除