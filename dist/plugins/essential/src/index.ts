import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher, i18n, ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";
import { findInReactTree } from "@vendetta/utils";

declare const React: any;

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const ActionSheetRow = findByProps("ActionSheetRow")?.ActionSheetRow ?? Forms.FormRow;
const MessageStore = findByStoreName("MessageStore");
const Messages = findByProps("sendMessage", "startEditMessage", "editMessage");
const HeaderName = findByName("HeaderName", false);
const DisplayName = findByName("DisplayName", false);

const originalMessages = new Map<string, any>();
let localEditTarget: { channelId: string; messageId: string } | null = null;
let patches: Array<() => void> = [];

const getMessageKey = (channelId: string, messageId: string) => `${channelId}:${messageId}`;

function hasRowStyle(style: any): boolean {
    if (Array.isArray(style)) return style.some(hasRowStyle);
    return style?.flexDirection === "row";
}

function installUsernamePatch() {
    if (!HeaderName || !DisplayName) return;

    // HeaderName is the component used by message headers. Mark only its
    // DisplayName child so the username is not added throughout the whole app.
    patches.push(after("default", HeaderName, (_args, result) => {
        if (result?.props) result.props.__essentialMessageHeader = true;
    }));

    patches.push(after("default", DisplayName, ([props], result) => {
        const user = props?.user;
        if (!props?.__essentialMessageHeader || !user?.username || !result) return;

        const row = findInReactTree(result, (node: any) => hasRowStyle(node?.props?.style));
        if (!row?.props) return;

        const marker = `essential-username-${user.id}`;
        const children = Array.isArray(row.props.children)
            ? [...row.props.children]
            : row.props.children == null
                ? []
                : [row.props.children];

        if (children.some((child: any) => child?.key === marker)) return;

        children.push(React.createElement(
            ReactNative.Text,
            {
                key: marker,
                numberOfLines: 1,
                ellipsizeMode: "tail",
                style: {
                    marginLeft: 4,
                    color: "#949BA4",
                    fontSize: 12,
                    fontWeight: "400",
                    flexShrink: 1,
                },
            },
            `• @${user.username}`,
        ));

        row.props.children = children;
    }));
}

function installLocalEditPatch() {
    if (!LazyActionSheet || !ActionSheetRow || !MessageStore || !Messages) return;

    patches.push(before("openLazy", LazyActionSheet, ([component, key, context]) => {
        const message = context?.message;
        if (key !== "MessageLongPressActionSheet" || !message) return;

        component.then((instance: any) => {
            const unpatchSheet = after("default", instance, (_args, result) => {
                setTimeout(unpatchSheet, 0);

                const buttons = findInReactTree(
                    result,
                    (node: any) => Array.isArray(node) && node?.[0]?.type?.name === "ActionSheetRow",
                );

                if (!buttons || buttons.some((button: any) => button?.props?.label === "Editar localmente")) return;

                const currentMessage = MessageStore.getMessage(message.channel_id, message.id) ?? message;
                const markUnreadIndex = buttons.findIndex(
                    (button: any) => button?.props?.message === i18n.Messages.MARK_UNREAD,
                );
                const position = markUnreadIndex >= 0 ? markUnreadIndex : 0;

                const handleLocalEdit = () => {
                    const messageKey = getMessageKey(currentMessage.channel_id, currentMessage.id);

                    if (!originalMessages.has(messageKey)) {
                        originalMessages.set(messageKey, JSON.parse(JSON.stringify(currentMessage)));
                    }

                    localEditTarget = {
                        channelId: currentMessage.channel_id,
                        messageId: currentMessage.id,
                    };

                    LazyActionSheet.hideActionSheet();
                    Messages.startEditMessage(
                        currentMessage.channel_id,
                        currentMessage.id,
                        currentMessage.content,
                    );
                };

                buttons.splice(position, 0, React.createElement(ActionSheetRow, {
                    label: "Editar localmente",
                    icon: React.createElement(ActionSheetRow.Icon, {
                        source: getAssetIDByName("ic_edit_24px"),
                    }),
                    onPress: handleLocalEdit,
                }));
            });
        });
    }));

    patches.push(before("editMessage", Messages, ([channelId, messageId, payload]) => {
        if (
            !localEditTarget
            || localEditTarget.channelId !== channelId
            || localEditTarget.messageId !== messageId
        ) return;

        const messageKey = getMessageKey(channelId, messageId);
        const original = originalMessages.get(messageKey);
        const currentMessage = MessageStore.getMessage(channelId, messageId) ?? original;

        localEditTarget = null;
        if (!currentMessage) return false;

        FluxDispatcher.dispatch({
            type: "MESSAGE_UPDATE",
            message: {
                ...currentMessage,
                content: payload?.content ?? "",
                edited_timestamp: null,
            },
            otherPluginBypass: true,
        });

        // Cancels Discord's real edit request. The update above exists only in
        // the local message store and is therefore visible only on this client.
        return false;
    }));

    patches.push(after("endEditMessage", Messages, () => {
        localEditTarget = null;
    }));
}

function restoreLocalEdits() {
    for (const original of originalMessages.values()) {
        const currentMessage = MessageStore?.getMessage?.(original.channel_id, original.id) ?? original;

        FluxDispatcher.dispatch({
            type: "MESSAGE_UPDATE",
            message: {
                ...currentMessage,
                content: original.content,
                edited_timestamp: original.edited_timestamp,
            },
            otherPluginBypass: true,
        });
    }
}

export default {
    onLoad() {
        installUsernamePatch();
        installLocalEditPatch();
    },

    onUnload() {
        patches.forEach((unpatch) => unpatch());
        patches = [];

        restoreLocalEdits();
        originalMessages.clear();
        localEditTarget = null;
    },
};
