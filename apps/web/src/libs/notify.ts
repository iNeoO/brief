import { notifications } from "@mantine/notifications";

const ERROR_AUTOCLOSE_MS = 8000;
// A confirmation needs less time on screen than a failure to act on.
const SUCCESS_AUTOCLOSE_MS = 4000;

export const notifyError = (message: string) => {
	notifications.show({
		color: "red",
		message,
		autoClose: ERROR_AUTOCLOSE_MS,
		withBorder: true,
		role: "alert",
	});
};

export const notifySuccess = (message: string) => {
	notifications.show({
		color: "teal",
		message,
		autoClose: SUCCESS_AUTOCLOSE_MS,
		withBorder: true,
		// `status`, not `alert`: a confirmation should not interrupt a screen
		// reader mid-sentence the way a failure should.
		role: "status",
	});
};
