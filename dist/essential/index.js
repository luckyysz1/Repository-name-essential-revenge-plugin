(function(exports,metro,common,patcher,assets,ui,utils){
"use strict";
const LazyActionSheet=metro.findByProps("openLazy","hideActionSheet");
const ActionSheetRow=metro.findByProps("ActionSheetRow")?.ActionSheetRow??ui.Forms.FormRow;
const MessageStore=metro.findByStoreName("MessageStore");
const Messages=metro.findByProps("sendMessage","startEditMessage","editMessage");
const HeaderName=metro.findByName("HeaderName",false);
const DisplayName=metro.findByName("DisplayName",false);
const originalMessages=new Map();
let localEditTarget=null;
let patches=[];
const getMessageKey=(channelId,messageId)=>`${channelId}:${messageId}`;
function hasRowStyle(style){if(Array.isArray(style))return style.some(hasRowStyle);return style?.flexDirection==="row"}
function installUsernamePatch(){
if(!HeaderName||!DisplayName)return;
patches.push(patcher.after("default",HeaderName,(_args,result)=>{if(result?.props)result.props.__essentialMessageHeader=true}));
patches.push(patcher.after("default",DisplayName,([props],result)=>{
const user=props?.user;
if(!props?.__essentialMessageHeader||!user?.username||!result)return;
const row=utils.findInReactTree(result,node=>hasRowStyle(node?.props?.style));
if(!row?.props)return;
const marker=`essential-username-${user.id}`;
const children=Array.isArray(row.props.children)?[...row.props.children]:row.props.children==null?[]:[row.props.children];
if(children.some(child=>child?.key===marker))return;
children.push(React.createElement(common.ReactNative.Text,{key:marker,numberOfLines:1,ellipsizeMode:"tail",style:{marginLeft:4,color:"#949BA4",fontSize:12,fontWeight:"400",flexShrink:1}},`• @${user.username}`));
row.props.children=children;
}));
}
function installLocalEditPatch(){
if(!LazyActionSheet||!ActionSheetRow||!MessageStore||!Messages)return;
patches.push(patcher.before("openLazy",LazyActionSheet,([component,key,context])=>{
const message=context?.message;
if(key!=="MessageLongPressActionSheet"||!message)return;
component.then(instance=>{
const unpatchSheet=patcher.after("default",instance,(_args,result)=>{
setTimeout(unpatchSheet,0);
const buttons=utils.findInReactTree(result,node=>Array.isArray(node)&&node?.[0]?.type?.name==="ActionSheetRow");
if(!buttons||buttons.some(button=>button?.props?.label==="Editar localmente"))return;
const currentMessage=MessageStore.getMessage(message.channel_id,message.id)??message;
const markUnreadIndex=buttons.findIndex(button=>button?.props?.message===common.i18n.Messages.MARK_UNREAD);
const position=markUnreadIndex>=0?markUnreadIndex:0;
const handleLocalEdit=()=>{
const messageKey=getMessageKey(currentMessage.channel_id,currentMessage.id);
if(!originalMessages.has(messageKey))originalMessages.set(messageKey,JSON.parse(JSON.stringify(currentMessage)));
localEditTarget={channelId:currentMessage.channel_id,messageId:currentMessage.id};
LazyActionSheet.hideActionSheet();
Messages.startEditMessage(currentMessage.channel_id,currentMessage.id,currentMessage.content);
};
buttons.splice(position,0,React.createElement(ActionSheetRow,{label:"Editar localmente",icon:React.createElement(ActionSheetRow.Icon,{source:assets.getAssetIDByName("ic_edit_24px")}),onPress:handleLocalEdit}));
});
});
}));
patches.push(patcher.before("editMessage",Messages,([channelId,messageId,payload])=>{
if(!localEditTarget||localEditTarget.channelId!==channelId||localEditTarget.messageId!==messageId)return;
const messageKey=getMessageKey(channelId,messageId);
const original=originalMessages.get(messageKey);
const currentMessage=MessageStore.getMessage(channelId,messageId)??original;
localEditTarget=null;
if(!currentMessage)return false;
common.FluxDispatcher.dispatch({type:"MESSAGE_UPDATE",message:{...currentMessage,content:payload?.content??"",edited_timestamp:null},otherPluginBypass:true});
return false;
}));
patches.push(patcher.after("endEditMessage",Messages,()=>{localEditTarget=null}));
}
function restoreLocalEdits(){
for(const original of originalMessages.values()){
const currentMessage=MessageStore?.getMessage?.(original.channel_id,original.id)??original;
common.FluxDispatcher.dispatch({type:"MESSAGE_UPDATE",message:{...currentMessage,content:original.content,edited_timestamp:original.edited_timestamp},otherPluginBypass:true});
}
}
const plugin={onLoad(){installUsernamePatch();installLocalEditPatch()},onUnload(){patches.forEach(unpatch=>unpatch());patches=[];restoreLocalEdits();originalMessages.clear();localEditTarget=null}};
exports.default=plugin;
Object.defineProperty(exports,"__esModule",{value:true});
return exports;
})({},vendetta.metro,vendetta.metro.common,vendetta.patcher,vendetta.ui.assets,vendetta.ui.components,vendetta.utils);
   
