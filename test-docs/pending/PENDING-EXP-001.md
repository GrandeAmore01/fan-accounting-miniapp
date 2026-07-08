\# PENDING-EXP-001 消费服务层未阻止相同记录重复提交



\## 基本信息



\- 问题编号：PENDING-EXP-001

\- 关联测试用例：TC-EXP-CRUD-012

\- 所属模块：消费记录模块

\- 问题类型：重复提交 / 防重复保护

\- 当前状态：Pending UI Verification



\## 问题描述



自动化测试直接连续两次调用消费新增服务，并提交相同 expenseId 的消费记录。



服务层最终保存了两条重复消费记录。



当前结果证明消费服务层本身未针对相同 expenseId 执行重复提交检查。



但是需求同时规定保存过程中应禁用重复提交，因此页面层可能通过禁用保存按钮阻止第二次提交。



因此当前自动化结果暂不能直接证明用户在实际页面连续点击保存一定会产生重复记录。



需要继续进行微信小程序界面测试。



\## 关联需求



消费保存要求：



\- 连续点击保存不能生成重复记录。

\- 保存过程中显示正在保存状态。

\- 保存过程中禁用重复提交。



\## 自动化测试方法



场景法与错误推测法。



测试代码连续执行：



```text

addExpense(expense)

addExpense(expense)

```



两次传入完全相同的：



```text

expenseId = expense-duplicate-test

```



\## 测试用例 TC-EXP-CRUD-012



\### 预期结果



消费记录仅保存一条。



```text

Expected length: 1

```



\### 实际结果



消费记录保存两条。



```text

Received length: 2

```



\## 当前判断



已确认：



```text

服务层不存在基于 expenseId 的重复新增保护。

```



尚未确认：



```text

实际小程序页面连续点击保存是否会生成重复消费。

```



页面可能通过保存按钮禁用机制阻止第二次服务调用。



\## 后续人工测试



需要执行：



```text

TC-EXP-UI-SAVE-001

```



测试步骤：



1\. 打开新增消费页面。

2\. 填写全部有效信息。

3\. 快速连续点击保存按钮。

4\. 观察保存过程中按钮状态。

5\. 返回消费列表。

6\. 检查是否生成重复消费记录。



需要验证：



```text

保存过程中是否显示正在保存状态

保存按钮是否立即禁用

第二次点击是否被阻止

最终是否只生成一条消费记录

```



\## 判定规则



如果页面连续点击后只生成一条记录，并且保存过程中按钮被禁用：



```text

TC-EXP-CRUD-012 属于服务层防御性测试失败

用户需求仍可能由 UI 层满足

不登记为用户功能缺陷

```



如果页面连续点击后生成两条或多条消费记录：



```text

确认正式缺陷

转为 DEF-EXP-012

```



\## 测试证据



```text

test-evidence/pending/EXP-DUPLICATE-SUBMIT/TC-EXP-CRUD-012\_FAIL\_duplicate-service-call.png

```



```text

test-evidence/pending/EXP-DUPLICATE-SUBMIT/TC-EXP-CRUD-012\_FAIL\_duplicate-result-summary.png

```



\## 后续状态



\- UI 验证状态：Pending

