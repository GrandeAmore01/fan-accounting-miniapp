\# DEF-EXP-007 保存见面消费后城市字段丢失



\## 基本信息



\- 缺陷编号：DEF-EXP-007

\- 关联测试用例：TC-EXP-CITY-007

\- 所属模块：消费记录模块

\- 缺陷类型：数据保存 / 字段持久化

\- 严重程度：High

\- 优先级：High

\- 当前状态：Open



\## 缺陷描述



用户创建见面消费并填写城市后，保存的消费记录未保留城市字段。



重新读取消费记录时，city 字段为 undefined。



\## 关联需求



见面消费城市字段要求：



\- 城市仅用于见面分类。

\- 匹配公共场次后自动填写城市。

\- 城市允许用户手动选择或填写。

\- 编辑记录时应正确回填城市。

\- 城市字段参与消费记录城市筛选。



\## 测试方法



数据持久化场景测试。



测试保存前输入城市，并在保存后重新读取消费记录，验证城市字段是否完整保留。



\## 测试用例 TC-EXP-CITY-007



\### 测试数据



创建消费：



```text

expenseId = expense-beijing

category = meet

itemName = 北京演唱会

city = 北京

```



\### 测试步骤



1\. 创建见面消费记录。

2\. 设置 city 为北京。

3\. 保存消费记录。

4\. 重新读取消费记录列表。

5\. 根据 expenseId 找到北京演唱会记录。

6\. 检查 city 字段。



\### 预期结果



```text

city = 北京

```



\### 实际结果



```text

city = undefined

```



自动化测试结果：



```text

Expected: "北京"

Received: undefined

```



\## 自动化测试



测试文件：



```text

tests/unit/expenseCityFilter.test.js

```



测试用例：



```text

TC-EXP-CITY-007

```



执行命令：



```text

npx jest tests/unit/expenseCityFilter.test.js --runInBand

```



\## 初步原因分析



消费数据在保存前经过标准化处理。



当前标准化结果未完整保留传入的 city 字段，因此城市数据在写入存储前已经丢失。



\## 风险



城市字段丢失会影响多个功能：



```text

消费记录编辑回填

城市筛选

见面消费信息展示

场次信息核对

按城市统计或后续扩展功能

```



即使单独实现城市筛选逻辑，由于已保存消费缺少 city 数据，筛选功能仍可能无法得到正确结果。



\## 测试证据



```text

test-evidence/defects/DEF-EXP-007/TC-EXP-CITY-007\_FAIL\_city-persistence.png

```



\## 回归测试



待开发修复后重新执行：



```text

TC-EXP-CITY-007

```



并重新执行城市筛选相关测试：



```text

TC-EXP-CITY-001

TC-EXP-CITY-002

TC-EXP-CITY-003

TC-EXP-CITY-004

TC-EXP-CITY-005

```



验证：



```text

城市字段能够保存

重新读取后城市字段保持不变

城市筛选能够使用已保存城市数据

```



\- 回归状态：Pending

