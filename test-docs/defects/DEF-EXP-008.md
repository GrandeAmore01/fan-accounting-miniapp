\# DEF-EXP-008 消费价格模式计算未按购买渠道和价格记录方式执行



\## 基本信息



\- 缺陷编号：DEF-EXP-008

\- 关联测试用例：TC-EXP-PRICE-001、TC-EXP-PRICE-004、TC-EXP-PRICE-005、TC-EXP-PRICE-006

\- 所属模块：消费记录模块

\- 缺陷类型：业务计算 / 价格模式

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



消费最终金额计算未根据消费分类、购买渠道和价格记录方式选择正确的金额来源。



当前系统在多个价格模式下仍使用普通 amount 字段参与统一乘法计算。



系统未正确使用以下价格字段：



```text

officialPrice

totalPrice

actualUnitPrice

```



导致见面官方渠道和藏品三种价格模式的最终金额计算错误。



\## 关联需求



价格模式要求：



\### 见面官方渠道



```text

最终金额 = 所选官方票价

```



\### 藏品官方渠道



```text

最终金额 = 官方单价 × 数量

```



\### 藏品其他渠道按总价记录



```text

最终金额 = 合计总价

```



数量不参与乘法。



\### 藏品其他渠道按单价计算



```text

最终金额 = 实际单价 × 数量

```



\## 测试方法



判定表法。



测试条件包括：



```text

消费分类

购买渠道

价格记录方式

官方价格

实际单价

合计总价

数量

```



通过故意设置普通 amount 字段与目标价格字段不同，验证程序实际采用的金额来源。



\## 测试用例 TC-EXP-PRICE-001



\### 测试条件



```text

category = meet

purchaseChannel = official

officialPrice = 580

amount = 999

quantity = 1

```



\### 预期结果



见面官方渠道应使用官方票价：



```text

580

```



\### 实际结果



```text

999

```



自动化测试结果：



```text

Expected: 580

Received: 999

```



系统实际使用普通 amount 字段。



\## 测试用例 TC-EXP-PRICE-004



\### 测试条件



```text

category = goods

purchaseChannel = official

officialPrice = 80

amount = 999

quantity = 3

```



\### 预期结果



```text

80 × 3 = 240

```



\### 实际结果



```text

999 × 3 = 2997

```



自动化测试结果：



```text

Expected: 240

Received: 2997

```



\## 测试用例 TC-EXP-PRICE-005



\### 测试条件



```text

category = goods

purchaseChannel = other

priceMode = total

totalPrice = 300

amount = 999

quantity = 5

```



\### 预期结果



按总价记录时：



```text

最终金额 = totalPrice

最终金额 = 300

```



数量不参与乘法。



\### 实际结果



```text

999 × 5 = 4995

```



自动化测试结果：



```text

Expected: 300

Received: 4995

```



\## 测试用例 TC-EXP-PRICE-006



\### 测试条件



```text

category = goods

purchaseChannel = other

priceMode = unit

actualUnitPrice = 60

amount = 999

quantity = 4

```



\### 预期结果



```text

60 × 4 = 240

```



\### 实际结果



```text

999 × 4 = 3996

```



自动化测试结果：



```text

Expected: 240

Received: 3996

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



当前最终金额计算逻辑未根据以下条件进行业务分支：



```text

category

purchaseChannel

priceMode

```



价格计算未正确读取：



```text

officialPrice

totalPrice

actualUnitPrice

```



多个价格模式仍使用普通 amount 字段和 quantity 执行统一乘法计算。



\## 风险



该问题会直接造成消费最终实际金额错误。



错误金额还可能继续影响：



```text

累计消费

预算进度

分类统计

月度趋势

年度统计

消费健康分析

```



属于核心业务金额计算问题。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-008/TC-EXP-PRICE-001\_004\_FAIL\_official-price-calculation.png

```



```text

test-evidence/defects/DEF-EXP-008/TC-EXP-PRICE-005\_006\_FAIL\_collection-price-mode-calculation.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-PRICE-001

TC-EXP-PRICE-004

TC-EXP-PRICE-005

TC-EXP-PRICE-006

```



验证：



```text

见面官方渠道使用官方票价

藏品官方渠道使用官方单价 × 数量

藏品总价模式不乘数量

藏品单价模式使用实际单价 × 数量

```



\- 回归状态：Pending

