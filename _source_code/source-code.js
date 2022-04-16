import { useEffect, useLayoutEffect, useState, useRef } from "react";
import {
	getItemTitle,
	getSchemaOptions,
	getNumberInputMaxLength,
} from "../../basicInfoItem";
import CustomSelect from "../../customSelect";
import BasicInfoKey from "../../common/basicInfoKey";
import { getInputStatus } from "./common";

const Option = CustomSelect.Option;

function numberInputEditor({
	root,
	data,
	isInexact,
	defaultExponent,
	setExponent,
	id,
	currentFocus,
	setCurrentFocus,
	showToolTip,
	inputType,
	isSecondInput,
	setInputStatus,
	schema,
	submit,
	setShowToolTip,
	noKey = false,
	defaultValue,
}) {
	const defaultReference = data?.data?.[0]?.reference;
	const [value, setValue] = useState(defaultValue || "");
	const [exponentValue, setExponentValue] = useState(defaultExponent || "");
	const [isFocus, setIsFocus] = useState(showToolTip);
	const ref = useRef();
	const exponentRef = useRef();
	const options = getSchemaOptions(schema);
	const maxLength = getNumberInputMaxLength(schema);
	const { tool: toolOptions } = options;
	const { unitOptionList } = toolOptions || {};
	const getFocusStatus = (value, inputStatus) => {
		//点击触发焦点开始验证输入，设置对应提示,值为空触发默认状态提示，与合法输入提示相同
		return value !== "" ? inputStatus : "legal";
	};

	const getScientificInputStatus = (base, exponent, first, second) => {
		if (base === "" && exponent === "") return "legal";
		if (base === "") return "illegal";
		if (first === "NaN" || first === "illegal") return first;
		if (second === "exponentIllegal") return "exponentIllegal";
		return "legal";
	};

	const clearInput = (ref, submit1, submit2) => {
		ref.current.value = "";
		submit1("");
		submit2("");
	};

	useEffect(() => {
		setValue(defaultValue);
		if (defaultValue !== value) ref.current.value = defaultValue;
	}, [defaultValue]);

	useEffect(() => {
		setExponent(defaultExponent);
		if (defaultExponent !== exponentValue)
			ref.current.value = defaultExponent;
	}, [defaultExponent]);

	useEffect(() => {
		const selector = getUniqueSchemaClassName("basicInfoContent");
		if (id === 0) $(`.${selector}`).attr("reference", defaultReference);
		return () => {};
	}, []);

	useEffect(() => {
		setShowToolTip(isFocus);
		if (inputType !== "scientific") {
			const inputStatus = getInputStatus(value, inputType, maxLength);
			if (isFocus && currentFocus === id) {
				const r = getFocusStatus(value, inputStatus);
				setInputStatus(r);
			} else {
				//合法输入或无内容（包括因非法输入被清空的）时清空提示
				if (inputStatus === "legal" || value === "") {
					setInputStatus("default");
				}
				//输入非数字时离开焦点清空内容，同时清空提示
				else if (inputStatus === "NaN") {
					setValue("");
					submit("");
					setInputStatus("default");
					ref.current.value = "";
					return;
				}
				//如果输入格式不正确的数字则保留错误提示
				else setInputStatus(inputStatus);
			}
		} else {
			const baseStatus = getInputStatus(value, inputType, maxLength);
			const exponentStatus = getInputStatus(
				exponentValue,
				"exponent",
				maxLength
			);
			if (isFocus && currentFocus === id) {
				setInputStatus(
					getScientificInputStatus(
						value,
						exponentValue,
						baseStatus,
						exponentStatus
					)
				);
			} else {
				if (exponentStatus === "exponentIllegal")
					clearInput(exponentRef, setExponent, setExponentValue);
				if (value === "" && exponentValue === "") {
					setInputStatus("default");
					return;
				}

				if (baseStatus === "illegal") {
					setInputStatus("illegal");
					return;
				}
				if (
					baseStatus === "NaN" ||
					exponentStatus === "exponentIllegal"
				) {
					if (baseStatus === "NaN") {
						clearInput(ref, setValue, submit);
						$(ref.current).width(8 + 4);
						setInputStatus("illegal");
					}
					if (exponentStatus === "exponentIllegal") {
						setInputStatus("exponentIllegal");
					}
					return;
				}

				if (baseStatus === "legal" && exponentStatus === "legal")
					setInputStatus("default");
			}
		}
		submit(value);
		setExponent(exponentValue);
	}, [value, exponentValue, inputType, isFocus, currentFocus]);

	const resetInputWidth = () => {
		const length = String(ref.current.value || "").replace(
			/[^\x00-\xff]/g,
			"01"
		).length;
		$(ref.current).width((length * 8 || 8) + 4);
	};

	useLayoutEffect(() => {
		//切换输入态时导入默认数据
		ref.current.value = defaultValue;
		const value = ref.current.value;
		$(ref.current).removeAttr("style");
		if (value === "") return;
		if (inputType === "percentage") {
			if (value[value.length - 1] !== "%") ref.current.value += "%";
		}
		if (inputType !== "percentage") {
			if (value[value.length - 1] === "%")
				ref.current.value = clearPercentage(value);
		}
		if (inputType === "scientific") {
			resetInputWidth();
		}
	}, [inputType]);

	const isClickAreaHasSchemaClassName = (element) => {
		let target = $(element);
		while (target.attr("class") !== undefined) {
			if (target.hasClass(schema.dataSchema.key + root)) {
				return true;
			}
			target = target.parent();
		}
		return false;
	};

	const getUniqueSchemaClassName = (defaultKey) => {
		return defaultKey + " " + (schema.dataSchema.key + root);
	};

	useEffect(() => {
		const fn = (e) => {
			const isClickTool = isClickAreaHasSchemaClassName(e.target);
			setIsFocus(isClickTool);
		};

		$(document).on("click", fn);
		return () => {
			$(document).off("click", fn);
		};
	}, [schema.dataSchema.key]);

	const clearPercentage = (text) => text.substring(0, text.length - 1);

	const exponentInput = (
		<>
			<span
				className={schema.dataSchema.key}
				style={{ marginRight: "4px" }}
			>
				X
			</span>
			<span className={schema.dataSchema.key}>10</span>

			<div className={"exponentInputContainer"}>
				<input
					className={getUniqueSchemaClassName("exponentInput")}
					placeholder="n"
					type={"text"}
					ref={(el) => {
						if (!el || exponentRef.current) return;
						exponentRef.current = el;
						if (defaultExponent !== null) {
							exponentRef.current.value = defaultExponent;
						}
					}}
					onChange={(e) => {
						setIsFocus(true);
						setCurrentFocus(id);
						const value = e.target.value;
						setExponentValue(value);
					}}
				></input>
			</div>
		</>
	);

	const rightContent = (
		<>
			<div
				className={getUniqueSchemaClassName("basicInfoContent")}
				style={{
					marginLeft: isSecondInput ? "68px" : "",
					position: "relative",
					userSelect: "none",
					marginRight: "28px",
				}}
				reference={defaultReference}
				onClick={() => setCurrentFocus(id)}
			>
				{isInexact && id === 0 && (
					<span style={{ color: "#999999" }}>约</span>
				)}
				<input
					ref={(el) => {
						//初始化百分数输入有值时自动加百分号
						if (!el || ref.current) return;
						ref.current = el;
						if (inputType === "percentage") {
							if (defaultValue !== "")
								ref.current.value = defaultValue + "%";
							else ref.current.value = "";
							return;
						}

						ref.current.value = defaultValue;
						if (inputType === "scientific") {
							resetInputWidth();
						}
					}}
					placeholder={inputType === "scientific" ? "a" : ""}
					onChange={(e) => {
						setIsFocus(true);
						setCurrentFocus(id);
						if (inputType === "percentage") {
							const value = e.target.value;
							if (
								value.length &&
								value[value.length - 1] !== "%"
							) {
								e.target.value += "%";
							}
							if (value === "" || value === "%") {
								setValue("");
								e.target.value = "";
								return;
							}
							setValue(clearPercentage(e.target.value));
							return;
						}
						if (inputType === "scientific") resetInputWidth();
						setValue(e.target.value);
					}}
					onKeyDown={() => {
						if (inputType === "percentage") {
							const endPosition = ref.current.selectionEnd;
							if (endPosition === ref.current.value.length)
								ref.current.selectionEnd -= 1;
						}
					}}
					className={
						getUniqueSchemaClassName("leftInput") +
						(inputType === "scientific" ? " scientific" : "")
					}
					type={"text"}
				></input>
				{inputType === "scientific" && exponentInput}
				{!isSecondInput && (
					<CustomSelect
						className={getUniqueSchemaClassName("rightSelect")}
						defaultValue={
							data?.data?.[0]?.unit ||
							unitOptionList?.[0]?.labelForView
						}
						listStyle={{
							width: 96,
							left: "unset",
							right: -9,
							top: 36,
						}}
						iconStyle={{ top: 6, right: 0 }}
						id={schema.dataSchema.key}
					>
						{unitOptionList &&
							unitOptionList.length &&
							unitOptionList.map((option) => {
								const { labelForView, label } = option;
								return (
									<Option
										key={label}
										value={label}
										labelForView={labelForView}
									>
										{label}
									</Option>
								);
							})}
					</CustomSelect>
				)}
			</div>
			<div className="inputTip" style={{ position: "absolute" }}></div>
		</>
	);

	if (noKey) {
		return rightContent;
	}
	return (
		<>
			{!isSecondInput && <BasicInfoKey text={getItemTitle(schema)} />}
			{rightContent}
		</>
	);
}

export default numberInputEditor;
