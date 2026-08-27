<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showDialog } from 'vant'
import { api, type OrderItem } from '@/api'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const order = ref<OrderItem | null>(null)

const statusText: Record<string, string> = {
  pending: '待执行',
  in_progress: '进行中',
  completed: '已完成',
  abnormal: '异常',
}

const statusTagType: Record<string, string> = {
  pending: 'default',
  in_progress: 'primary',
  completed: 'success',
  abnormal: 'danger',
}

const progress = computed(() => {
  if (!order.value) return 0
  return Math.round((order.value.completedQuantity / order.value.planQuantity) * 100)
})

const fetchOrder = async () => {
  loading.value = true
  try {
    const id = Number(route.params.id)
    const orders = await api.getOrders()
    order.value = orders.find(o => o.id === id) || null
  } catch (e: any) {
    showToast('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const handleAction = async (action: 'start' | 'complete' | 'abnormal') => {
  if (!order.value) return
  try {
    if (action === 'start') await api.startOrder(order.value.id)
    else if (action === 'complete') await api.completeOrder(order.value.id)
    else await api.abnormalOrder(order.value.id)
    showToast.success(`${action === 'start' ? '开始' : action === 'complete' ? '完成' : '异常'}操作成功`)
    await fetchOrder()
  } catch (e: any) {
    showToast('操作失败: ' + e.message)
  }
}

onMounted(fetchOrder)
</script>

<template>
  <div class="page">
    <van-nav-bar
      title="工单详情"
      left-arrow
      @click-left="router.back()"
    >
      <template v-if="order" #right>
        <van-tag :type="statusTagType[order.status]" size="medium">
          {{ statusText[order.status] }}
        </van-tag>
      </template>
    </van-nav-bar>

    <van-loading v-if="loading" class="loading" size="24px" vertical>加载中...</van-loading>

    <template v-else-if="order">
      <div class="section">
        <div class="section-title">基本信息</div>
        <van-cell-group :border="false">
          <van-cell title="工单号" :value="order.orderNo" />
          <van-cell title="产品名称" :value="order.productName" />
          <van-cell title="计划数量" :value="order.planQuantity + ' kg'" />
          <van-cell title="已完成数量" :value="order.completedQuantity + ' kg'" />
        </van-cell-group>
        <div class="progress-wrap">
          <div class="progress-label">
            <span>完成进度</span>
            <span class="progress-value">{{ progress }}%</span>
          </div>
          <van-progress :percentage="progress" stroke-width="8" :color="progress === 100 ? '#07c160' : '#1989fa'" />
        </div>
      </div>

      <div class="section">
        <div class="section-title">工单状态</div>
        <van-cell-group :border="false">
          <van-cell title="当前状态">
            <template #value>
              <van-tag :type="statusTagType[order.status]" size="small">
                {{ statusText[order.status] }}
              </van-tag>
            </template>
          </van-cell>
        </van-cell-group>
      </div>

      <div class="bottom-bar">
        <template v-if="order.status === 'pending'">
          <van-button type="primary" block round size="large" @click="handleAction('start')">
            开始任务
          </van-button>
        </template>
        <template v-else-if="order.status === 'in_progress'">
          <van-button type="default" block round size="large" @click="handleAction('abnormal')">
            报告异常
          </van-button>
          <van-button type="primary" block round size="large" @click="handleAction('complete')">
            完成任务
          </van-button>
        </template>
        <template v-else-if="order.status === 'completed'">
          <div class="completed-hint">
            <van-icon name="passed" color="#07c160" size="20" />
            <span>该工单已完成</span>
          </div>
        </template>
        <template v-else-if="order.status === 'abnormal'">
          <div class="completed-hint" style="color: #ee0a24;">
            <van-icon name="warning-o" color="#ee0a24" size="20" />
            <span>该工单存在异常</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 140px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 60px;
}

.section {
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.progress-wrap {
  padding: 12px 16px 0;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
}

.progress-value {
  font-weight: 600;
  color: #1989fa;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.step-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
  flex-shrink: 0;
}

.step-icon.done {
  background: #07c160;
}

.step-icon .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}

.step-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-num {
  font-size: 11px;
  color: #999;
}

.step-name {
  font-size: 14px;
  color: #333;
}

.timeline {
  padding-left: 8px;
}

.timeline-item {
  position: relative;
  padding-left: 20px;
  padding-bottom: 16px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1989fa;
}

.timeline-line {
  position: absolute;
  left: 4px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: #e8e8e8;
}

.timeline-time {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.timeline-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.timeline-operator {
  font-size: 13px;
  color: #1989fa;
  font-weight: 500;
}

.timeline-action {
  font-size: 13px;
  color: #333;
}

.timeline-remark {
  font-size: 12px;
  color: #999;
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: #fff;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}

.completed-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  font-size: 14px;
  color: #07c160;
}
</style>
