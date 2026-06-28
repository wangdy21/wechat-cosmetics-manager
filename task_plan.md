# Task Plan: 包装日期智能推断

## Goal
将 MiMo 识别从"区分生产日期/有效期"改为"提取包装日期+云函数推断"，提高日期识别成功率。参考 spec: `docs/superpowers/specs/2026-06-28-package-date-inference-design.md`

## Current Phase
Phase 1

## Phases

### Phase 1: 修改 MiMo Prompt（mimo.js）
- [ ] USER_PROMPT: expiryDate + productionDate → packageDate
- [ ] 更新测试中的 prompt 断言
- **Status:** pending

### Phase 2: 新增 inferDates + 修改 index.js
- [ ] 在 index.js 中实现 inferDates() 函数
- [ ] 修改 normalizeMiMoInfo: 校验 packageDate
- [ ] 修改 handleRecognizeProduct: 调用 inferDates，调整返回字段
- **Status:** pending

### Phase 3: 更新测试
- [ ] mimo.test.js: 更新 prompt 格式断言
- [ ] productOps.test.js: 新增 inferDates 测试用例
- [ ] 运行全部测试，确保通过
- **Status:** pending

### Phase 4: 前端适配（add.js）
- [ ] 简化 onChooseImage 中的日期填充逻辑
- [ ] 展示 packageDate 供用户核对
- **Status:** pending

### Phase 5: 集成验证
- [ ] 本地运行全部测试
- [ ] 用实际图片测试端到端流程
- **Status:** pending
