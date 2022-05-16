static code analyze for React Hooks/静态分析 React组件中Hooks依赖关系，生成每个effect的依赖项和调用项结果

## 示例代码
```js
import React, { useEffect, useState } from "react";

function Test() {
    const [, setState1] = useState(0);
    const [, setState2] = useState(0);
    const [, setState3] = useState(0);
    const [, setState4] = useState(0);
    const [, setState5] = useState(0);

    function Call123() {
        setState1(1);
        Call23();
    }

    function Call23() {
        setState2(1);
        setState3(1);
    }

    function Call12345(){
        setTimeout(() => {
            Call123();
        }, 100);

        setState4(1);
        setState5(1);
    }
    useEffect(() => {
        Call12345();
    }, [a, b, c.d.e, f]);

    return <>{"test"}</>;
}
export default Test;
```

### 运行命令 hooks-dep-trace -path {path} --save后保存result.json内容如下
```json
{
    "Test": {
        "effect1": {
            "dependencies": ["a", "b", "c.d.e", "f"],
            "effectCall": [
                "setState1",
                "setState2",
                "setState3",
                "setState4",
                "setState5"
            ]
        }
    }
}
```
### 代码递归查询hooks中调用的setState副作用及其依赖，最终生成依赖结果