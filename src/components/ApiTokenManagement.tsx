import {Alert, AutoComplete, Button, DatePicker, Form, Input, message, Modal, Popconfirm, Radio, Space, Spin, Tag, Typography} from "antd";
import type {ColumnsType} from "antd/es/table";
import {DeleteOutlined, KeyOutlined, PlusCircleFilled} from "@ant-design/icons";
import {useCallback, useEffect, useState} from "react";
import dayjs, {type Dayjs} from "dayjs";
import type {UserAPI} from "@vempain/vempain-auth-frontend";
import {UserName, VempainTable} from "@vempain/vempain-auth-frontend";
import type {ApiTokenAPI} from "../models/apiTokenAPI";
import type {ApiTokenCreatedResponse, ApiTokenNetworkResponse, ApiTokenRequest, ApiTokenResponse, ApiTokenScope} from "../models/apiToken";
import {isValidNetwork} from "../tools/apiTokenTools";

interface TokenFormValues {
    description: string;
    network: string;
    expires_at: Dayjs;
    scope?: ApiTokenScope;
}

export interface ApiTokenScopeOption {
    value: ApiTokenScope;
    label: string;
}

export interface ApiTokenManagementProps {
    api: ApiTokenAPI;
    userAPI: UserAPI;
    scopeOptions: ApiTokenScopeOption[];
    defaultScope?: ApiTokenScope;
    descriptionPlaceholder: string;
    creationTitle: string;
    description: string;
    networkHint: (suggestion: ApiTokenNetworkResponse | null) => string;
    createdTokenDescription: (token: ApiTokenResponse) => string;
    sticky: boolean | object;
    formatDateTime: (value: Dayjs) => string;
}

export function ApiTokenManagement({
                                       api,
                                       userAPI,
                                       scopeOptions,
                                       defaultScope,
                                       descriptionPlaceholder,
                                       creationTitle,
                                       description,
                                       networkHint,
                                       createdTokenDescription,
                                       sticky,
                                       formatDateTime
                                   }: ApiTokenManagementProps) {
    const [tokens, setTokens] = useState<ApiTokenResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState<ApiTokenCreatedResponse | null>(null);
    const [suggestion, setSuggestion] = useState<ApiTokenNetworkResponse | null>(null);
    const [form] = Form.useForm<TokenFormValues>();

    const load = useCallback(() => {
        setLoading(true);
        api.list()
                .then(setTokens)
                .catch(error => {
                    console.error("Failed to load API tokens:", error);
                    message.error("Failed to load the API tokens");
                })
                .finally(() => setLoading(false));
    }, [api]);

    useEffect(() => {
        let mounted = true;
        api.list()
                .then(response => {
                    if (mounted) setTokens(response);
                })
                .catch(error => {
                    console.error("Failed to load API tokens:", error);
                    message.error("Failed to load the API tokens");
                })
                .finally(() => {
                    if (mounted) setLoading(false);
                });
        return () => {
            mounted = false;
        };
    }, [api]);

    function openCreate() {
        setCreating(true);
        api.defaultNetwork()
                .then(response => {
                    setSuggestion(response);
                    form.setFieldsValue({network: response.network ?? ""});
                })
                .catch(error => {
                    console.error("Failed to fetch the default token network:", error);
                    setSuggestion(null);
                });
    }

    function submit(values: TokenFormValues) {
        const request: ApiTokenRequest = {
            description: values.description.trim(),
            network: values.network.trim(),
            expires_at: values.expires_at.toISOString(),
            scope: values.scope
        };
        setSubmitting(true);
        api.createToken(request)
                .then(response => {
                    setCreated(response);
                    setCreating(false);
                    form.resetFields();
                    load();
                })
                .catch(error => {
                    console.error("Failed to create API token:", error);
                    message.error("Failed to create the API token");
                })
                .finally(() => setSubmitting(false));
    }

    function remove(token: ApiTokenResponse) {
        api.deleteToken(token.id)
                .then(() => {
                    message.success(`API token ${token.token_prefix} deleted`);
                    load();
                })
                .catch(error => {
                    console.error("Failed to delete API token:", error);
                    message.error("Failed to delete the API token");
                });
    }

    const columns: ColumnsType<ApiTokenResponse> = [
        {title: "Token", dataIndex: "token_prefix", key: "token_prefix", render: (prefix: string) => <code>{prefix}…</code>},
        {title: "Description", dataIndex: "description", key: "description"},
        {title: "Scope", dataIndex: "scope", key: "scope", render: (scope: string) => <Tag color={scope === "MCP_READ" ? "blue" : "default"}>{scope}</Tag>},
        {title: "Network", dataIndex: "network", key: "network", render: (network: string) => <code>{network}</code>},
        {
            title: "Expires", dataIndex: "expires_at", key: "expires_at",
            render: (value: string, record: ApiTokenResponse) => (
                    <Space>
                        {formatDateTime(dayjs(value))}
                        {record.expired && <Tag color="red">expired</Tag>}
                    </Space>
            )
        },
        {title: "Owner", dataIndex: "owner_user_id", key: "owner_user_id", render: (id: number) => <UserName userAPI={userAPI} id={id}/>},
        {title: "Created", dataIndex: "created", key: "created", render: (value: string) => formatDateTime(dayjs(value))},
        {title: "Last used", dataIndex: "last_used", key: "last_used", render: (value: string | null) => value ? formatDateTime(dayjs(value)) : "never"},
        {
            title: "Actions", key: "actions",
            render: (_value: unknown, record: ApiTokenResponse) => (
                    <Popconfirm title="Delete this API token?" description="The service using it stops working immediately."
                                okText="Delete" cancelText="Cancel" onConfirm={() => remove(record)}>
                        <Button danger icon={<DeleteOutlined/>} aria-label={`Delete token ${record.token_prefix}`}/>
                    </Popconfirm>
            )
        }
    ];

    return <div className="DarkDiv">
        <Space style={{justifyContent: "space-between", width: "100%"}}>
            <h1><KeyOutlined/> API tokens</h1>
            <Button type="primary" icon={<PlusCircleFilled/>} onClick={openCreate}>Create token</Button>
        </Space>
        <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
        <Spin spinning={loading}>
            <VempainTable dataSource={tokens} columns={columns} rowKey="id" pagination={false} sticky={sticky}/>
        </Spin>
        <Modal open={creating} title={creationTitle} onOk={() => form.submit()} onCancel={() => setCreating(false)}
               confirmLoading={submitting} okText="Create" destroyOnHidden>
            <Form form={form} layout="vertical" onFinish={submit} initialValues={{expires_at: dayjs().add(1, "year"), scope: defaultScope}}>
                <Form.Item name="description" label="Description" rules={[{required: true, whitespace: true, max: 255}]}>
                    <Input placeholder={descriptionPlaceholder}/>
                </Form.Item>
                <Form.Item name="network" label="Allowed network (IPv4 or IPv6, CIDR or single address)"
                           extra={networkHint(suggestion)}
                           rules={[{required: true, whitespace: true}, {
                               validator: (_rule, value) => isValidNetwork(value)
                                       ? Promise.resolve()
                                       : Promise.reject(new Error("Enter an IPv4/IPv6 address or CIDR network"))
                           }]}>
                    <AutoComplete placeholder="10.0.0.0/24 or 2001:db8::/32"
                                  options={(suggestion?.candidates ?? []).map(candidate => ({
                                      value: candidate.network,
                                      label: `${candidate.network} (${candidate.interface_name}, ${candidate.address})`
                                  }))}/>
                </Form.Item>
                {scopeOptions.length > 0 && <Form.Item name="scope" label="Token scope" rules={[{required: true}]}>
                    <Radio.Group aria-label="Token scope" options={scopeOptions}/>
                </Form.Item>}
                <Form.Item name="expires_at" label="Expires at"
                           rules={[{required: true}, {
                               validator: (_rule, value: Dayjs | undefined) => value && value.isAfter(dayjs())
                                       ? Promise.resolve()
                                       : Promise.reject(new Error("The expiration must be in the future"))
                           }]}>
                    <DatePicker showTime style={{width: "100%"}} disabledDate={date => date.isBefore(dayjs(), "day")}/>
                </Form.Item>
            </Form>
        </Modal>
        <Modal open={created !== null} title="API token created" onOk={() => setCreated(null)} onCancel={() => setCreated(null)}
               cancelButtonProps={{style: {display: "none"}}} okText="I have stored the token" destroyOnHidden>
            {created !== null && <Space orientation="vertical" style={{width: "100%"}}>
                <Alert type="warning" showIcon title="Copy the token now; it is shown only once and can not be retrieved later."/>
                <Typography.Paragraph copyable={{text: created.token}} code data-testid="created-token">{created.token}</Typography.Paragraph>
                <Typography.Text type="secondary">{createdTokenDescription(created.api_token)}</Typography.Text>
            </Space>}
        </Modal>
    </div>;
}
