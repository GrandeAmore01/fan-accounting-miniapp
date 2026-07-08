\# DEF-EXP-009 交通费住宿费和其他分类错误参与数量乘法



\## 基本信息



\- 缺陷编号：DEF-EXP-009

\- 关联测试用例：TC-EXP-PRICE-007、TC-EXP-PRICE-008、TC-EXP-PRICE-009

\- 所属模块：消费记录模块

\- 缺陷类型：业务计算 / 分类金额规则

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



交通费、住宿费和其他分类的最终金额被错误乘以数量。



需求规定这三个分类直接填写本次实际总金额，不显示数量，也不进行单价乘法。



系统当前仍使用 amount × quantity 计算最终金额。



\## 关联需求



以下分类：



```text

交通费

住宿费

其他

```



应直接使用：



```text

最终金额 = 用户输入的实际总金额

```



数量不参与计算。



\## 测试方法



判定表法与异常组合测试。



测试中故意给不应使用数量的分类传入大于 1 的 quantity。



若金额计算正确，quantity 不应改变最终金额。



\## 测试用例 TC-EXP-PRICE-007



\### 测试条件



```text

category = travel

amount = 450

quantity = 8

```



\### 预期结果



```text

450

```



\### 实际结果



```text

3600

```



自动化测试结果：



```text

Expected: 450

Received: 3600

```



实际计算：



```text

450 × 8 = 3600

```



\## 测试用例 TC-EXP-PRICE-008



\### 测试条件



```text

category = hotel

amount = 1200

quantity = 3

```



\### 预期结果



```text

1200

```



\### 实际结果



```text

3600

```



自动化测试结果：



```text

Expected: 1200

Received: 3600

```



\## 测试用例 TC-EXP-PRICE-009



\### 测试条件



```text

category = other

amount = 200

quantity = 6

```



\### 预期结果



```text

200

```



\### 实际结果



```text

1200

```



自动化测试结果：



```text

Expected: 200

Received: 1200

```



\## 自动化测试



测试文件：



```text

tests/unit/expensePriceMode.test.js

```



执行命令：



```text

npx jest tests/unit/expensePriceMode.test.js --runInBand

```



\## 初步原因分析



当前金额计算逻辑统一使用 amount 和 quantity。



程序未根据消费分类判断数量是否适用。



因此交通费、住宿费和其他分类也参与了数量乘法。



\## 风险



用户填写的实际总金额可能被错误放大数倍。



例如：



```text

住宿费 1200 元

```



可能错误统计为：



```text

3600 元

```



错误数据会继续影响预算和消费统计。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-009/TC-EXP-PRICE-007\_008\_009\_FAIL\_non-collection-amount.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-PRICE-007

TC-EXP-PRICE-008

TC-EXP-PRICE-009

```



验证：



```text

交通费直接使用实际总金额

住宿费直接使用实际总金额

其他分类直接使用实际总金额

quantity 不影响上述分类金额

```



\- 回归状态：Pending

