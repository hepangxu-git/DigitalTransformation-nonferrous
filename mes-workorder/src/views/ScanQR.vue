<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { api, type OrderItem } from '@/api'

const router = useRouter()
const route = useRoute()
const orderNo = ref('')
const records = ref<{ orderNo: string; productName: string; time: string }[]>([])
const activeTab = ref('scan')

const handleScan = async () => {
  try {
    const allOrders = await api.getOrders()
    const randomOrder = allOrders[Math.floor(Math.random() * allOrders.length)]

    records.value.unshift({
      orderNo: randomOrder.orderNo,
      productName: randomOrder.productName,
      time: new Date().toLocaleString('zh-CN'),
    })
    if (records.value.length > 5) {
      records.value = records.value.slice(0, 5)
    }

    showDialog({
      title: '扫码成功',
      message: `已识别工单：${randomOrder.orderNo}`,
      confirmButtonText: '查看详情',
    }).then(() => {
      router.push(`/order-detail/${randomOrder.id}`)
    }).catch(() => {
      router.push(`/order-detail/${randomOrder.id}`)
    })
  } catch (e: any) {
    showToast('扫码失败: ' + e.message)
  }
}

const handleConfirm = async () => {
  if (!orderNo.value.trim()) return
  try {
    const allOrders = await api.getOrders()
    const found = allOrders.find(o => o.orderNo === orderNo.value.trim())
    if (found) {
      router.push(`/order-detail/${found.id}`)
    } else {
      showToast('未找到该工单')
    }
  } catch (e: any) {
    showToast('查询失败: ' + e.message)
  }
}

const handleTabChange = (name: string) => {
  if (name !== 'scan') {
    router.push(`/${name}`)
  }
}

watch(() => route.name, (name) => {
  if (name) activeTab.value = name as string
}, { immediate: true })
</script>

<template>
  <div class="page">
    <van-nav-bar title="扫码开始任务" left-arrow @click-left="router.back()" />

    <div class="scan-area">
      <div class="scan-wrapper">
        <div class="scan-box">
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>
          <div class="scan-line"></div>
        </div>
      </div>
      <van-button type="primary" block round size="large" @click="handleScan">
        点击扫码
      </van-button>
    </div>

    <div class="divider-area">
      <span class="divider-text">或手动输入工单号</span>
    </div>

    <div class="input-area">
      <van-field
        v-model="orderNo"
        placeholder="请输入工单号，如 WO-2024-001"
        clearable
        class="input-field"
      />
      <van-button type="primary" size="small" @click="handleConfirm">确认</van-button>
    </div>

    <div class="section">
      <div class="section-title">最近扫码记录</div>
      <van-cell-group inset v-if="records.length > 0">
        <van-cell
          v-for="(r, idx) in records.slice(0, 5)"
          :key="idx"
          :title="r.orderNo"
          :label="r.time"
          :value="r.productName"
        />
      </van-cell-group>
      <van-empty v-else description="暂无扫码记录" image-size="60" />
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
.page {
  min-height: 100vh;
  background: #0a0e14;
  padding-bottom: 90px;
}

.scan-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px 16px 20px;
}

.scan-wrapper {
  width: 260px;
  height: 260px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.scan-box {
  width: 220px;
  height: 220px;
  border: 2px solid rgba(25, 137, 250, 0.5);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: #1989fa;
  border-style: solid;
}

.tl { top: -1px; left: -1px; border-width: 3px 0 0 3px; border-radius: 8px 0 0 0; }
.tr { top: -1px; right: -1px; border-width: 3px 3px 0 0; border-radius: 0 8px 0 0; }
.bl { bottom: -1px; left: -1px; border-width: 0 0 3px 3px; border-radius: 0 0 0 8px; }
.br { bottom: -1px; right: -1px; border-width: 0 3px 3px 0; border-radius: 0 0 8px 0; }

.scan-line {
  position: absolute;
  top: 0;
  left: 10px;
  right: 10px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #1989fa, #00d4ff, #1989fa, transparent);
  box-shadow: 0 0 8px rgba(25, 137, 250, 0.8);
  animation: scan 2s linear infinite;
}

@keyframes scan {
  0% { top: 0; }
  100% { top: 100%; }
}

.divider-area {
  display: flex;
  align-items: center;
  padding: 0 32px;
  margin-bottom: 16px;
}

.divider-area::before,
.divider-area::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #333;
}

.divider-text {
  padding: 0 16px;
  font-size: 13px;
  color: #666;
}

.input-area {
  display: flex;
  gap: 10px;
  padding: 0 16px 20px;
}

.input-field {
  flex: 1;
  border-radius: 8px;
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
}
</style>
