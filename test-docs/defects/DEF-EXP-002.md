\# DEF-EXP-002 藏品数量范围与整数校验不完整



\## 基本信息



\- 缺陷编号：DEF-EXP-002

\- 关联测试用例：TC-EXP-010、TC-EXP-013、TC-EXP-014

\- 所属模块：消费记录模块

\- 缺陷类型：输入校验 / 数量边界处理

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



藏品数量校验未完整实现数量范围与整数限制。



系统当前错误处理以下数量：



1\. 输入数量 0 时，被作为有效数据处理。

2\. 输入数量 11 时，被作为有效数据处理。

3\. 输入数量 1.5 时，被作为有效数据处理。



需求规定藏品数量必须为 1～10 之间的整数。



\## 关联需求



藏品数量要求：



\- 数量仅用于藏品分类。

\- 默认数量为 1。

\- 数量范围为 1～10。

\- 数量必须是整数。

\- 数量为 1 时不能继续减少。

\- 数量为 10 时不能继续增加。



\## 测试方法



边界值分析法与等价类划分法。



数量有效范围：



```text

1 <= quantity <= 10

```



且数量必须为整数。



测试选取：



```text

0

1

10

11

1.5

\-1

```



覆盖下边界外、下边界、上边界、上边界外、非整数和负数情况。



\## 测试用例 TC-EXP-010



\### 测试数据



```text

quantity = 0

```



\### 预期结果



系统拒绝保存。



```text

valid = false

```



\### 实际结果



系统接受该数据。



自动化测试结果：



```text

Expected: false

Received: true

```



\## 测试用例 TC-EXP-013



\### 测试数据



```text

quantity = 11

```



\### 预期结果



系统拒绝保存。



```text

valid = false

```



\### 实际结果



系统接受数量 11。



自动化测试结果：



```text

Expected: false

Received: true

```



\## 测试用例 TC-EXP-014



\### 测试数据



```text

quantity = 1.5

```



\### 预期结果



系统拒绝保存。



```text

valid = false

```



\### 实际结果



系统接受非整数数量。



自动化测试结果：



```text

Expected: false

Received: true

```



\## 自动化测试



测试文件：



```text

tests/unit/expenseService.test.js

```



执行命令：



```text

npx jest tests/unit/expenseService.test.js --runInBand

```



\## 初步原因分析



当前数量标准化逻辑使用默认值处理数量。



显式输入数值 0 时，0 被作为 falsy 值处理，因此可能被替换为默认数量 1。



同时当前数量校验主要检查数量是否大于 0，未完整检查：



```text

quantity <= 10

```



以及：



```text

Number.isInteger(quantity)

```



因此数量 11 和数量 1.5 可以通过校验。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-002/TC-EXP-010_013_014_FAIL_quantity-validation.png

```



```text

test-evidence/defects/DEF-EXP-002/TC-EXP-013\_014\_FAIL\_quantity-range-integer.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-010

TC-EXP-013

TC-EXP-014

```



\- 回归状态：Pending

