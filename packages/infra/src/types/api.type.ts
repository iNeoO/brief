export type ApiResponse<T> = {
	data: T;
};

export type ApiResponseWithDate<T extends {}, K extends keyof T> = T & {
	[P in K]: Date;
};
