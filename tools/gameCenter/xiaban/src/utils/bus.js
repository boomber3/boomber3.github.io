// 模块化重构：由 paper-theater-runner.html 拆出
// 极简事件总线：跨模块解耦（如"升级触发"由 main.js 装配注册）
const handlers = {};
export const bus = {
  on(evt, fn) { (handlers[evt] ||= []).push(fn); },
  emit(evt, ...args) { for (const fn of handlers[evt] || []) fn(...args); },
};
