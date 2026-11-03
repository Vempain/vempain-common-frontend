import {DownOutlined} from "@ant-design/icons";
import {Button, type ButtonProps, Dropdown, Space} from "antd";
import {type CSSProperties, type ReactNode, useState} from "react";

/** One action of a {@link SplitActionButton}: what the main part does while this action is the selected one. */
export interface SplitAction {
    /** Identifies the action; the selected key is reported through `onActionSelect` */
    key: string;
    /** Shown in the menu and, while selected, as the label of the main button */
    label: ReactNode;
    /** Runs when the main button is clicked while this action is selected; optional for a `htmlType="submit"` button whose form does the work */
    onClick?: () => void | Promise<void>;
    /** A disabled action can be seen in the menu but not selected */
    disabled?: boolean;
}

export interface SplitActionButtonProps {
    /** The actions to choose from, at least one; the first one is selected unless `defaultActionKey` or `selectedActionKey` says otherwise */
    actions: SplitAction[];
    /** The initially selected action (uncontrolled) */
    defaultActionKey?: string;
    /** The selected action (controlled); pair it with `onActionSelect` */
    selectedActionKey?: string;
    /** Called when the user picks another action in the menu; the action itself is not run */
    onActionSelect?: (key: string) => void;
    type?: ButtonProps["type"];
    size?: ButtonProps["size"];
    /** The form behaviour of the main button, `submit` lets a surrounding form run its `onFinish` with the selected action */
    htmlType?: ButtonProps["htmlType"];
    disabled?: boolean;
    loading?: boolean;
    /** Accessible name of the arrow part that opens the menu */
    menuLabel?: string;
    className?: string;
    style?: CSSProperties;
    "data-testid"?: string;
}

export const SPLIT_ACTION_MENU_LABEL = "Choose action";

/**
 * A split button: the main part runs the selected action and shows its label, the arrow part opens a menu of the actions. Picking an
 * action in the menu only selects it (the label changes), nothing runs until the main part is clicked. Ant Design's `Dropdown.Button`
 * runs the menu item on pick, which is why this component exists; it is generic, the host supplies the labels and the callbacks.
 */
export function SplitActionButton({
                                      actions,
                                      defaultActionKey,
                                      selectedActionKey,
                                      onActionSelect,
                                      type = "primary",
                                      size,
                                      htmlType = "button",
                                      disabled = false,
                                      loading = false,
                                      menuLabel = SPLIT_ACTION_MENU_LABEL,
                                      className,
                                      style,
                                      "data-testid": testId,
                                  }: SplitActionButtonProps) {
    const [internalKey, setInternalKey] = useState<string | undefined>(defaultActionKey);
    const requestedKey = selectedActionKey ?? internalKey;
    const selected = actions.find(action => action.key === requestedKey) ?? actions[0];

    function select(key: string) {
        const action = actions.find(candidate => candidate.key === key);
        if (!action || action.disabled) {
            return;
        }
        if (selectedActionKey === undefined) {
            setInternalKey(key);
        }
        onActionSelect?.(key);
    }

    if (!selected) {
        return null;
    }

    return (
            <Space.Compact className={className} style={style} data-testid={testId}>
                <Button type={type} size={size} htmlType={htmlType} disabled={disabled} loading={loading}
                        data-testid={testId ? `${testId}-main` : undefined}
                        onClick={() => void selected.onClick?.()}>
                    {selected.label}
                </Button>
                <Dropdown
                        trigger={["click"]}
                        disabled={disabled || loading}
                        menu={{
                            items: actions.map(action => ({key: action.key, label: action.label, disabled: action.disabled})),
                            selectable: true,
                            selectedKeys: [selected.key],
                            onClick: ({key}) => select(String(key)),
                        }}
                >
                    <Button type={type} size={size} htmlType={"button"} disabled={disabled || loading} icon={<DownOutlined/>}
                            aria-label={menuLabel} aria-haspopup={"menu"} data-testid={testId ? `${testId}-menu` : undefined}/>
                </Dropdown>
            </Space.Compact>
    );
}
