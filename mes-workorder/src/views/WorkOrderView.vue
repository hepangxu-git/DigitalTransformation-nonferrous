<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { api, type OrderItem } from '@/api'

const router = useRouter()
const route = useRoute()
const orders = ref<OrderItem[]>([])
const loading = ref(false)
const activeTab = ref('workorder')

const currentShift = ref('A班')
const operatorName = ref('张三')

const fetchOrders = async () => {
  loading.value = true
  try {
    orders.value = await api.getOrders()
  } catch (e: any) {
    showToast('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const getProgress = (order: OrderItem) => Math.round((order.completedQuantity / order.planQuantity) * 100)

const statusText: Record<string, string> = {
  pending: '待开始', in_progress: '进行中', completed: '已完成', abnormal: '异常',
}
const statusColor: Record<string, string> = {
  pending: '#999', in_progress: '#1989fa', completed: '#07c160', abnormal: '#ee0a24',
}

const handleStartOrder = async (order: OrderItem) => {
  try {
    await api.startOrder(order.id)
    showToast('任务已开始')
    await fetchOrders()
  } catch (e: any) {
    showToast('操作失败: ' + e.message)
  }
}

const handleTabChange = (name: string) => {
  if (name !== 'workorder') {
    router.push(`/${name}`)
  }
}

watch(() => route.name, (name) => {
  if (name) activeTab.value = name as string
}, { immediate: true })

onMounted(fetchOrders)
</script>

<template>
  <div class="workorder-page">
    <div class="header">
      <div class="header-info">
        <div class="shift-info"><span class="label">当前班次</span><span class="value">{{ currentShift }}</span></div>
        <div class="operator-info"><span class="label">操作员</span><span class="value">{{ operatorName }}</span></div>
      </div>
      <div class="header-title">生产工单管理</div>
    </div>

    <div class="content">
      <van-loading v-if="loading" class="loading" size="24px" vertical>加载中...</van-loading>

      <van-pull-refresh v-else v-model="loading" @refresh="fetchOrders">
        <div class="order-list">
          <div v-for="order in orders" :key="order.id" class="order-card" @click="router.push(`/order-detail/${order.id}`)">
            <div class="order-header">
              <span class="order-no">{{ order.orderNo }}</span>
              <span class="order-status" :style="{ color: statusColor[order.status] }">{{ statusText[order.status] }}</span>
            </div>
            <div class="order-info">
              <div class="info-row"><span class="info-label">产品名称</span><span class="info-value">{{ order.productName }}</span></div>
              <div class="info-row"><span class="info-label">计划数量</span><span class="info-value">{{ order.planQuantity }} kg</span></div>
              <div class="info-row"><span class="info-label">已完成</span><span class="info-value">{{ order.completedQuantity }} kg</span></div>
            </div>
            <div class="progress-section">
              <div class="progress-header"><span>完成进度</span><span class="progress-percent">{{ getProgress(order) }}%</span></div>
              <van-progress :percentage="getProgress(order)" :color="statusColor[order.status]" track-color="#e8e8e8" stroke-width="8" />
            </div>
            <div class="order-actions" @click.stop>
              <van-button type="primary" size="small" :disabled="order.status !== 'pending'" @click="handleStartOrder(order)">开始任务</van-button>
              <van-button type="warning" size="small" @click="router.push(`/report?orderId=${order.orderNo}`)">报告异常</van-button>
            </div>
          </div>
        </div>
      </van-pull-refresh>
    </div>

    <van-tabbar v-model="activeTab" @change="handleTabChange">
      <van-tabbar-item name="workorder" icon="orders-o">工单</van-tabbar-item>
      <van-tabbar-item name="scan" icon="scan">扫码</van-tabbar-item>
      <van-tabbar-item name="statistics" icon="chart-trending-o">统计</van-tabbar-item>
      <van-tabbar-item name="equipment" icon="label-o">设备</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.workorder-page { min-height: 100vh; background: #f5f7fa; padding-bottom: 90px; }
.header { background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%); padding: 20px 16px; color: #fff; }
.header-title { font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 12px; }
.header-info { display: flex; justify-content: space-between; }
.shift-info, .operator-info { display: flex; flex-direction: column; align-items: center; }
.label { font-size: 12px; opacity: 0.8; }
.value { font-size: 16px; font-weight: 500; margin-top: 4px; }
.content { padding: 12px; }
.loading { display: flex; justify-content: center; padding: 40px; }
.order-list { display: flex; flex-direction: column; gap: 12px; }
.order-card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f0f0f0; }
.order-no { font-size: 16px; font-weight: 600; color: #333; }
.order-status { font-size: 13px; font-weight: 500; }
.order-info { margin-bottom: 12px; }
.info-row { display: flex; justify-content: space-between; padding: 6px 0; }
.info-label { font-size: 13px; color: #999; }
.info-value { font-size: 13px; color: #333; font-weight: 500; }
.progress-section { margin-bottom: 12px; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #666; }
.progress-percent { font-weight: 600; color: #1989fa; }
.order-actions { display: flex; gap: 10px; }
.order-actions .van-button { flex: 1; }
</style>
