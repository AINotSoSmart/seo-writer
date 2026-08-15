export type ServerActionRes<T = void> = {
    success: boolean;
    data?: T;
    error?: string;
};