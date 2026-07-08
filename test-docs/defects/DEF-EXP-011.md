\# DEF-EXP-011 消费价格模式相关字段在标准化后丢失



\## 基本信息



\- 缺陷编号：DEF-EXP-011

\- 关联测试用例：TC-EXP-PRICE-012、TC-EXP-PRICE-013、TC-EXP-PRICE-014

\- 所属模块：消费记录模块

\- 缺陷类型：数据保存 / 字段持久化

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



消费记录通过校验和标准化处理后，价格模式相关字段未被完整保留。



当前确认丢失的字段包括：



```text

purchaseChannel

priceMode

officialPrice

```



上述字段在测试输入中存在，但标准化后的消费数据中为 undefined。



\## 关联需求



消费记录应根据实际情况保存和展示：



```text

购买渠道

价格记录方式

官方参考价

实际单价

数量

合计总价

最终实际金额

```



见面和藏品的金额计算还依赖购买渠道及价格记录方式。



\## 测试方法



数据持久化场景测试。



向消费校验函数提交完整价格模式数据，并检查标准化后的 data 对象是否保留对应字段。



\## 测试用例 TC-EXP-PRICE-012



\### 测试条件



```text

purchaseChannel = other

```



\### 预期结果



标准化后：



```text

purchaseChannel = other

```



\### 实际结果



```text

purchaseChannel = undefined

```



自动化测试结果：



```text

Expected: "other"

Received: undefined

```



\## 测试用例 TC-EXP-PRICE-013



\### 测试条件



```text

category = goods

purchaseChannel = other

priceMode = total

totalPrice = 300

```



\### 预期结果



标准化后：



```text

priceMode = total

```



\### 实际结果



```text

priceMode = undefined

```



自动化测试结果：



```text

Expected: "total"

Received: undefined

```



\## 测试用例 TC-EXP-PRICE-014



\### 测试条件



```text

purchaseChannel = official

officialPrice = 580

```



\### 预期结果



标准化后：



```text

officialPrice = 580

```



\### 实际结果



```text

officialPrice = undefined

```



自动化测试结果：



```text

Expected: 580

Received: undefined

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



消费数据标准化过程中未完整复制价格模式相关字段。



因此用户选择或填写的：



```text

purchaseChannel

priceMode

officialPrice

```



在标准化结果中丢失。



后续保存、编辑、列表展示和价格计算无法可靠获取这些数据。



\## 风险



该问题会影响：



```text

购买渠道展示

价格记录方式展示

编辑记录回填

官方价格计算

藏品总价模式计算

藏品单价模式计算

消费统计数据准确性

```



该问题也是价格计算规则无法正确执行的重要数据基础问题之一。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-011/TC-EXP-PRICE-012\_013\_FAIL\_price-mode-persistence.png

```



```text

test-evidence/defects/DEF-EXP-011/TC-EXP-PRICE-014\_FAIL\_official-price-persistence.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-PRICE-012

TC-EXP-PRICE-013

TC-EXP-PRICE-014

```



并重新执行：



```text

TC-EXP-PRICE-001

TC-EXP-PRICE-004

TC-EXP-PRICE-005

TC-EXP-PRICE-006

```



验证价格模式字段保存后，金额计算能够正确获取对应数据。



\- 回归状态：Pending

