# AWS Marketplace SNS 配置清单

本文档说明如何在 AWS 控制台完成 CostQ 的 Marketplace SNS 订阅配置。

## 已知产品信息

- Product ID: `prod-ssodbgfe4cgma`
- Product code: `2p87p8znttoi3byyvne3pr3jb`
- Product ARN: `arn:aws:aws-marketplace:us-east-1:642157749042:AWSMarketplace/SaaSProduct/prod-ssodbgfe4cgma`
- Subscription topic ARN: `arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-2p87p8znttoi3byyvne3pr3jb`
- Entitlement topic ARN: `arn:aws:sns:us-east-1:287250355862:aws-mp-entitlement-notification-2p87p8znttoi3byyvne3pr3jb`

## 代码中的接收地址

- Fulfillment URL:
  - `https://agent.costq.jp/api/marketplace/fulfillment`
- SNS HTTPS endpoint:
  - `https://agent.costq.jp/api/marketplace/sns`

说明：

- `fulfillment` 用于买家订阅后跳转开通。
- `sns` 用于接收订阅状态和 entitlement 事件。
- `sns` endpoint 已实现 `SubscriptionConfirmation` 自动确认逻辑。

## 环境变量配置

运行环境至少要配置以下变量：

- `MARKETPLACE_REGION=us-east-1`
- `MARKETPLACE_PRODUCT_CODE=2p87p8znttoi3byyvne3pr3jb`
- `MARKETPLACE_SELLER_ACCOUNT_ID=642157749042`
- `MARKETPLACE_FULFILLMENT_RETURN_URL=https://agent.costq.jp/marketplace/onboarding`
- `MARKETPLACE_SUBSCRIPTION_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:287250355862:aws-mp-subscription-notification-2p87p8znttoi3byyvne3pr3jb`
- `MARKETPLACE_ENTITLEMENT_SNS_TOPIC_ARN=arn:aws:sns:us-east-1:287250355862:aws-mp-entitlement-notification-2p87p8znttoi3byyvne3pr3jb`

可参考：

- [marketplace.env.example](/Users/liyuguang/data/gitworld/costq/costq-web/deployment/k8s/marketplace.env.example)

## 控制台配置步骤

### 1. 确认产品级参数

在 AWS Marketplace Management Portal 中确认：

- Product code 与运行环境一致
- Fulfillment URL 已设置为：
  - `https://agent.costq.jp/api/marketplace/fulfillment`

### 2. 打开 Subscription SNS Topic

在 AWS Console 中：

1. 切换到 `us-east-1`
2. 打开 `Amazon SNS`
3. 进入 Topic:
   - `aws-mp-subscription-notification-2p87p8znttoi3byyvne3pr3jb`
4. 点击 `Create subscription`

填写：

- Protocol: `HTTPS`
- Endpoint: `https://agent.costq.jp/api/marketplace/sns`

创建后：

- AWS 会向该 endpoint 发送 `SubscriptionConfirmation`
- CostQ 后端会自动访问 `SubscribeURL` 完成确认

### 3. 打开 Entitlement SNS Topic

在 AWS Console 中：

1. 切换到 `us-east-1`
2. 打开 `Amazon SNS`
3. 进入 Topic:
   - `aws-mp-entitlement-notification-2p87p8znttoi3byyvne3pr3jb`
4. 点击 `Create subscription`

填写：

- Protocol: `HTTPS`
- Endpoint: `https://agent.costq.jp/api/marketplace/sns`

说明：

- 两个 topic 都指向同一个 HTTPS endpoint
- 后端会根据消息内容区分 subscription event 和 entitlement event

## 成功判定

### SNS 控制台

两个 subscription 的状态都应为：

- `Confirmed`

### CostQ 服务日志

后端日志里应能看到：

- 成功处理 `SubscriptionConfirmation`
- 成功写入 `marketplace_notifications`

如果买家已订阅，还应能看到：

- `subscribe-success`
- `entitlement-updated`

## 常见问题排查

### 1. Subscription 一直是 PendingConfirmation

排查：

- `https://agent.costq.jp/api/marketplace/sns` 是否公网可达
- ALB / Ingress / WAF 是否阻挡了 SNS 请求
- FastAPI 日志里是否有 `/api/marketplace/sns` 请求
- `SubscriptionConfirmation` 是否被签名校验拒绝

### 2. SNS 已 Confirmed，但没有业务事件入库

排查：

- `MARKETPLACE_SUBSCRIPTION_SNS_TOPIC_ARN` 是否与产品页一致
- `MARKETPLACE_ENTITLEMENT_SNS_TOPIC_ARN` 是否与产品页一致
- `MARKETPLACE_REGION` 是否为 `us-east-1`
- 数据库表 `marketplace_notifications` 是否有记录

### 3. 买家订阅后无法开通

排查：

- 控制台 Fulfillment URL 是否已改为：
  - `https://agent.costq.jp/api/marketplace/fulfillment`
- `ResolveCustomer` 是否成功
- `GetEntitlements` 是否成功
- 前端 onboarding 页是否能正常打开

### 4. metering 正常但没有接收到取消订阅事件

排查：

- subscription topic 的 HTTPS subscription 是否还存在
- SNS endpoint 是否被变更
- `marketplace_notifications` 中是否有 `unsubscribe-pending` / `unsubscribe-success`

## 建议的验证顺序

1. 配置环境变量
2. 确认 Fulfillment URL
3. 给两个 SNS topic 建 HTTPS subscription
4. 等待 `Confirmed`
5. 用 allowlisted / test buyer 做一次订阅
6. 验证：
   - fulfillment 跳转
   - onboarding
   - SNS subscription 事件
   - entitlement 事件
   - metering dry-run / submit
