<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { api, type EquipmentItem } from '@/api'

const router = useRouter()
const route = useRoute()
const search = ref('')
const devices = ref<EquipmentItem[]>([])
const showDetail = ref(false)
const selectedDevice = ref<EquipmentItem | null>(null)
const autoRefresh = ref(true)
const activeTab = ref('equipment')
let timer: number | null = null

const statusText: Record<string, string> = {
  normal: '正常',
  warning: '预警',
  alert: '告警',
}

const statusTagType: Record<string, string> = {
  normal: 'success',
  warning: 'warning',
  alert: 'danger',
}

const filteredDevices = computed(() => {
  if (!search.value) return devices.value
  const s = search.value.toLowerCase()
  return devices.value.filter(
    d => d.name.toLowerCase().includes(s)
  )
})

const refreshData = async () => {
  try {
    devices.value = await api.getEquipment()
  } catch (e: any) {
    showToast('刷新失败: ' + e.message)
  }
}

const handleRefresh = async () => {
  await refreshData()
  showToast('刷新成功')
}

const showDeviceDetail = (device: EquipmentItem) => {
  selectedDevice.value = device
  showDetail.value = true
}

const handleTabChange = (name: string) => {
  if (name !== 'equipment') {
    router.push(`/${name}`)
  }
}

watch(() => route.name, (name) => {
  if (name) activeTab.value = name as string
}, { immediate: true })

onMounted(async () => {
  await refreshData()
  timer = window.setInterval(() => {
    if (autoRefresh.value) refreshData()
  }, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="page">
    <van-nav-bar title="设备状态">
      <template #right>
        <div class="nav-right">
          <span v-if="autoRefresh" class="auto-hint">自动刷新中...</span>
          <van-icon name="replay" size="20" @click="handleRefresh" />
        </div>
      </template>
    </van-nav-bar>

    <van-search
      v-model="search"
      placeholder="输入设备名称或编号"
      shape="round"
      show-action
    >
      <template #action v-if="search">
        <span @click="search = ''" style="color: #1989fa">清除</span>
      </template>
    </van-search>

    <div class="device-list">
      <van-empty v-if="filteredDevices.length === 0" description="未找到匹配设备" image-size="80" />

      <div
        v-for="device in filteredDevices"
        :key="device.id"
        class="device-card"
        @click="showDeviceDetail(device)"
      >
        <div class="card-header">
          <div class="device-info">
            <div class="device-name">{{ device.name }}</div>
            <div class="device-code">{{ device.code }}</div>
          </div>
          <van-tag :type="statusTagType[device.status]" size="medium">
            {{ statusText[device.status] }}
          </van-tag>
        </div>

        <div class="card-params">
          <span class="param-item">温度：{{ device.temp }}℃</span>
          <span class="param-divider">|</span>
          <span class="param-item">压力：{{ device.pressure }}MPa</span>
          <span class="param-divider">|</span>
          <span class="param-item">状态：{{ statusText[device.status] }}</span>
        </div>

      </div>
    </div>

    <van-dialog
      v-model:show="showDetail"
      title="设备详情"
      confirm-button-text="关闭"
      show-cancel-button
      :show-cancel-button="false"
    >
      <div v-if="selectedDevice" class="detail-content">
        <div class="detail-item">
          <span class="detail-label">设备名称</span>
          <span class="detail-value">{{ selectedDevice.name }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">设备编号</span>
          <span class="detail-value">{{ selectedDevice.id }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">运行状态</span>
          <van-tag :type="statusTagType[selectedDevice.status]" size="small">
            {{ statusText[selectedDevice.status] }}
          </van-tag>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前温度</span>
          <span class="detail-value">{{ selectedDevice.temp }}℃</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">当前压力</span>
          <span class="detail-value">{{ selectedDevice.pressure }} MPa</span>
        </div>
      </div>
    </van-dialog>

    <van-tabbar v-model="activeTab" @change="handleTabChange">
      <van-tabbar-item name="workorder" icon="orders-o">工单</van-tabbar-item>
      <van-tabbar-item name="scan" icon="scan">扫码</van-tabbar-item>
      <van-tabbar-item name="statistics" icon="chart-trending-o">统计</van-tabbar-item>
      <van-tabbar-item name="equipment" icon="label-o">设备</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #f5f7fa; padding-bottom: 90px; }
.nav-right { display: flex; align-items: center; gap: 8px; }
.auto-hint { font-size: 11px; color: #07c160; animation: blink 1.5s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.device-list { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 10px; }
.device-card { background: #fff; border-radius: 12px; padding: 14px 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.device-name { font-size: 15px; font-weight: 600; color: #333; }
.device-code { font-size: 12px; color: #999; margin-top: 2px; }
.card-params { display: flex; align-items: center; gap: 6px; padding: 10px 0; border-top: 1px solid #f5f5f5; font-size: 13px; color: #666; }
.param-item { white-space: nowrap; }
.param-divider { color: #ddd; }
.card-order { font-size: 12px; color: #1989fa; margin-top: 4px; }
.detail-content { padding: 8px 16px; }
.detail-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.detail-item:last-child { border-bottom: none; }
.detail-label { font-size: 13px; color: #999; }
.detail-value { font-size: 13px; color: #333; font-weight: 500; }
.order-link { color: #1989fa; }
</style>
