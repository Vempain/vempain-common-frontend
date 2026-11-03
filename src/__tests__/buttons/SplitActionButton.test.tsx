import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {useState} from "react";
import {SPLIT_ACTION_MENU_LABEL, type SplitAction, SplitActionButton} from "../../buttons";

function actionsWith(save: jest.Mock, publish: jest.Mock, extra: Partial<SplitAction> = {}): SplitAction[] {
    return [
        {key: "save", label: "Save page", onClick: save},
        {key: "save-publish", label: "Save and publish", onClick: publish, ...extra},
    ];
}

async function pick(label: string) {
    fireEvent.click(screen.getByRole("button", {name: SPLIT_ACTION_MENU_LABEL}));
    const item = await screen.findByRole("menuitem", {name: label});
    fireEvent.click(item);
}

describe("SplitActionButton", () => {
    it("shows the first action and runs only it when the main part is clicked", () => {
        const save = jest.fn();
        const publish = jest.fn();
        render(<SplitActionButton actions={actionsWith(save, publish)}/>);

        fireEvent.click(screen.getByRole("button", {name: "Save page"}));
        expect(save).toHaveBeenCalledTimes(1);
        expect(publish).not.toHaveBeenCalled();
    });

    it("picking an action in the menu changes the label without running anything, the main part then runs it", async () => {
        const save = jest.fn();
        const publish = jest.fn();
        const onActionSelect = jest.fn();
        render(<SplitActionButton actions={actionsWith(save, publish)} onActionSelect={onActionSelect}/>);

        await pick("Save and publish");
        expect(onActionSelect).toHaveBeenCalledWith("save-publish");
        expect(publish).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(screen.getByRole("button", {name: "Save and publish"})).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Save page"})).toBeNull();

        fireEvent.click(screen.getByRole("button", {name: "Save and publish"}));
        expect(publish).toHaveBeenCalledTimes(1);
        expect(save).not.toHaveBeenCalled();
    });

    it("starts with the default action and marks the selected item in the menu", async () => {
        render(<SplitActionButton actions={actionsWith(jest.fn(), jest.fn())} defaultActionKey="save-publish"/>);
        expect(screen.getByRole("button", {name: "Save and publish"})).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: SPLIT_ACTION_MENU_LABEL}));
        const item = await screen.findByRole("menuitem", {name: "Save and publish"});
        expect(item.className).toContain("selected");
    });

    it("is controlled through selectedActionKey", async () => {
        function Host() {
            const [key, setKey] = useState("save");
            return (
                    <>
                        <SplitActionButton actions={actionsWith(jest.fn(), jest.fn())} selectedActionKey={key} onActionSelect={setKey}/>
                        <span data-testid="key">{key}</span>
                    </>
            );
        }

        render(<Host/>);
        await pick("Save and publish");
        expect(screen.getByTestId("key")).toHaveTextContent("save-publish");
        expect(screen.getByRole("button", {name: "Save and publish"})).toBeInTheDocument();
    });

    it("keeps the selection when the controller refuses the change", async () => {
        const onActionSelect = jest.fn();
        render(<SplitActionButton actions={actionsWith(jest.fn(), jest.fn())} selectedActionKey="save" onActionSelect={onActionSelect}/>);
        await pick("Save and publish");
        expect(onActionSelect).toHaveBeenCalledWith("save-publish");
        expect(screen.getByRole("button", {name: "Save page"})).toBeInTheDocument();
    });

    it("does not select a disabled action", async () => {
        const onActionSelect = jest.fn();
        render(<SplitActionButton actions={actionsWith(jest.fn(), jest.fn(), {disabled: true})} onActionSelect={onActionSelect}/>);
        await pick("Save and publish");
        await waitFor(() => expect(screen.getByRole("button", {name: "Save page"})).toBeInTheDocument());
        expect(onActionSelect).not.toHaveBeenCalled();
    });

    it("submits a surrounding form when asked to and falls back to the first action for an unknown key", () => {
        const onSubmit = jest.fn(event => event.preventDefault());
        render(
                <form onSubmit={onSubmit}>
                    <SplitActionButton actions={actionsWith(jest.fn(), jest.fn())} selectedActionKey="unknown" htmlType="submit" data-testid="split"/>
                </form>
        );
        expect(screen.getByTestId("split-main")).toHaveTextContent("Save page");
        fireEvent.click(screen.getByTestId("split-main"));
        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("split-menu")).toHaveAttribute("aria-haspopup", "menu");
    });

    it("disables both parts together and renders nothing without actions", () => {
        const {rerender} = render(<SplitActionButton actions={actionsWith(jest.fn(), jest.fn())} disabled/>);
        expect(screen.getByRole("button", {name: "Save page"})).toBeDisabled();
        expect(screen.getByRole("button", {name: SPLIT_ACTION_MENU_LABEL})).toBeDisabled();

        rerender(<SplitActionButton actions={[]}/>);
        expect(screen.queryByRole("button")).toBeNull();
    });
});
