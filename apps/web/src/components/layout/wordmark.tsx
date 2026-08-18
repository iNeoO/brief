import { BRAND_NAME } from "@brief/common/constants";
import classes from "./layout.module.css";

export function Wordmark() {
	return (
		<span className={classes.wordmark}>
			{BRAND_NAME}
			<span className={classes.wordmarkStop}>.</span>
		</span>
	);
}
