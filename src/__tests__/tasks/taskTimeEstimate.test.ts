import {remainingTimeText} from "../../tasks/taskTimeEstimate";

describe("remainingTimeText", () => {
    it("has no text without an estimate", () => {
        expect(remainingTimeText(null)).toBeNull();
        expect(remainingTimeText(undefined)).toBeNull();
        expect(remainingTimeText(-1)).toBeNull();
        expect(remainingTimeText(Number.NaN)).toBeNull();
    });

    it("rounds the estimate to a coarse unit", () => {
        expect(remainingTimeText(0)).toEqual({key: "TaskProgress.remainingUnderMinute"});
        expect(remainingTimeText(59)).toEqual({key: "TaskProgress.remainingUnderMinute"});
        expect(remainingTimeText(60)).toEqual({key: "TaskProgress.remainingMinutes", options: {minutes: 1}});
        expect(remainingTimeText(95)).toEqual({key: "TaskProgress.remainingMinutes", options: {minutes: 2}});
        expect(remainingTimeText(59 * 60 + 20)).toEqual({key: "TaskProgress.remainingMinutes", options: {minutes: 59}});
        expect(remainingTimeText(3600)).toEqual({key: "TaskProgress.remainingWholeHours", options: {hours: 1}});
        expect(remainingTimeText(3599)).toEqual({key: "TaskProgress.remainingWholeHours", options: {hours: 1}});
        expect(remainingTimeText(2 * 3600 + 5 * 60)).toEqual({key: "TaskProgress.remainingHours", options: {hours: 2, minutes: 5}});
    });
});
