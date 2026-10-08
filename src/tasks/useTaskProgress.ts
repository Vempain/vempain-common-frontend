import {useContext} from "react";
import type {TaskProgressContextValue} from "./TaskProgressContextValue";
import {taskProgressContext} from "./TaskProgressContextValue";

export function useTaskProgress(): TaskProgressContextValue {
    const context = useContext(taskProgressContext);
    if (!context) {
        throw new Error("useTaskProgress must be used inside a TaskProgressProvider");
    }
    return context;
}
