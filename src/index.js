import fs from "fs";
import * as espree from "espree";
import esquery from "esquery";
const fileContent = fs
    .readFileSync("../_source_code/numberInputEditor.js")
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

const stateHooks = [];
const effectHooks = [];
const functionMap = {};
const setStateCallMap = {};
const dependencyMap = [];
const effectFunctionMap = {};
const effectSelector = esquery.parse(`[callee.name=/^set/]`);
const callExpressionSelector = esquery.parse(`[type=CallExpression]`);

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
        Node.declarations[0].init.type === "ArrowFunctionExpression"
    ) {
        functionName = Node.declarations[0].id.name;
        functionBody = Node.declarations[0].init.body;
    }
    if (functionName) {
        addFunctionToMap(functionName, functionBody, functionMap);
    }
}

function addEffectAndDependency(effectNodes, dependenceNodes) {
    if (!effectNodes.length || !dependenceNodes.length) {
        return;
    }
    const dependenceStateList = dependenceNodes.map((Node) => Node.name);
    const effectList = effectNodes.map((Node) => Node.callee.name);
}

function findSetStateCall() {
    effectHooks.forEach((Node) => {
        const dependenceNodes = Node.expression.arguments[1].elements;
        const Nodes = esquery.match(Node, effectSelector);
        addEffectAndDependency(Nodes, dependenceNodes);
    });
}

function useStateFilter(Node) {
    return (
        Node.type === "VariableDeclaration" &&
        Node.declarations[0].init.type === "CallExpression" &&
        Node.declarations[0].init.callee.name === "useState"
    );
}

function getUseStateDeclarations(Node) {
    const { elements } = Node.declarations[0].id;
    return [elements[0].name, elements[1].name];
}

function findEffectInRecursion(name, Node) {
    const Nodes = esquery.match(Node, callExpressionSelector);
    const callExpressionList = Nodes.flatMap((Node) => {
        if (!Node.callee.name) {
            return [];
        } else return [Node.callee.name];
    });
    console.log(callExpressionList);
    if (!callExpressionList.length) {
        return;
    }
    callExpressionList.forEach((functionName) => {
        if (functionName.startsWith("set")) {
            console.log(name, functionName);
            if (!effectFunctionMap[name]) {
                effectFunctionMap[name] = [functionName];
            } 
            else effectFunctionMap[name].push(functionName);
        }
        if (!functionMap[functionName]) {
            return;
        }
    });
}

function findEffectInFunction() {
    Object.entries(functionMap).forEach(([name, Node]) => {
        findEffectInRecursion(name, Node);
    });
}

const ast = espree
    .parse(fileContent, parseOption)
    .body.filter(
        (node) =>
            node.type === "VariableDeclaration" ||
            node.type === "FunctionDeclaration"
    )[2];
const testBody = ast.body.body;

testBody.forEach((Node) => {
    getAllFunctionDeclarations(Node, functionMap);
});
Object.keys(functionMap).forEach((functionName) => {
    setStateCallMap[functionName] = {};
});
const useStateDeclarationAst = testBody.filter(useStateFilter);
const useEffectdeclarationAst = testBody.filter(useEffectFilter);
const useStateDeclarations = useStateDeclarationAst.map(
    getUseStateDeclarations
);

for (const declaration of useStateDeclarations) {
    stateHooks.push(declaration);
}
for (const declaration of useEffectdeclarationAst) {
    effectHooks.push(declaration);
}
findSetStateCall();
findEffectInFunction();
//todo 圈复杂度提示 effect自动转箭头函数配置 effect hooks递归检查
