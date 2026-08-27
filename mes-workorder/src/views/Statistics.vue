<script setup lang="ts">
import { ref, onMounted, watch, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'
import { showToast } from 'vant'
import { api, type OrderItem } from '@/api'

use([
  CanvasRenderer,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
])

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const updateTime = ref('')
const activeTab = ref('statistics')
const summary = ref({
  totalOrders: 0,
  inProgress: 0,
  completed: 0,
  paused: 0,
  abnormal: 0,
  pending: 0,
})

const barOption = shallowRef({})
const pieOption = shallowRef({})
const ringOption = shallowRef({})

const fetchData = async () => {
  loading.value = true
  try {
    const orders = await api.getOrders()

    summary.value = {
      totalOrders: orders.length,
      inProgress: orders.filter(o => o.status === 'in_progress').length,
      completed: orders.filter(o => o.status === 'completed').length,
      paused: 0,
      abnormal: orders.filter(o => o.status === 'abnormal').length,
      pending: orders.filter(o => o.status === 'pending').length,
    }

    const dates = ['02-23', '02-24', '02-25', '02-26', '02-27', '02-28', '03-01']
    const values = [3, 5, 2, 4, 3, 4, summary.value.completed || 6]

    barOption.value = {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(255,255,255,0.9)', borderColor: '#eee' },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: { color: '#666', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [{
        name: '完成数量',
        type: 'bar',
        data: values,
        barWidth: '40%',
        itemStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#1989fa' }, { offset: 1, color: '#0d6efd' }] },
          borderRadius: [4, 4, 0, 0],
        },
      }],
    }

    pieOption.value = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '0%', left: 'center', textStyle: { fontSize: 11, color: '#666' } },
      color: ['#1989fa', '#07c160', '#ff976a', '#ee0a24'],
      series: [{
        name: '工单状态',
        type: 'pie',
        radius: ['0%', '55%'],
        center: ['50%', '42%'],
        label: { show: true, position: 'outside', fontSize: 11 },
        data: [
          { name: '进行中', value: summary.value.inProgress },
          { name: '已完成', value: summary.value.completed },
          { name: '异常', value: summary.value.abnormal },
          { name: '待开始', value: summary.value.pending },
        ],
      }],
    }

    const productMap = new Map<string, number>()
    orders.forEach(o => {
      productMap.set(o.productName, (productMap.get(o.productName) || 0) + 1)
    })

    ringOption.value = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '0%', left: 'center', textStyle: { fontSize: 11, color: '#666' } },
      color: ['#1989fa', '#07c160', '#ff976a', '#a78bfa', '#f0b429', '#ee0a24', '#06b6d4'],
      series: [{
        name: '产品分布',
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '42%'],
        label: { show: true, position: 'outside', fontSize: 11 },
        data: Array.from(productMap.entries()).map(([name, value]) => ({ name, value })),
      }],
    }

    updateTime.value = new Date().toLocaleString('zh-CN')
  } catch (e: any) {
    showToast('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

const handleRefresh = async () => {
  await fetchData()
  showToast('刷新成功')
}

const handleTabChange = (name: string) => {
  if (name !== 'statistics') {
    router.push(`/${name}`)
  }
}

watch(() => route.name, (name) => {
  if (name) activeTab.value = name as string
}, { immediate: true })

onMounted(fetchData)
</script>

<template>
  <div class="page">
    <van-nav-bar title="工单统计">
      <template #right>
        <van-icon name="replay" size="20" @click="handleRefresh" />
      </template>
    </van-nav-bar>

    <van-loading v-if="loading" class="loading" size="24px" vertical>加载中...</van-loading>

    <template v-else>
      <div class="stat-cards">
        <van-grid :column-num="4" :gutter="10" :border="false">
          <van-grid-item>
            <div class="stat-card card-total">
              <span class="stat-num">{{ summary.totalOrders }}</span>
              <span class="stat-label">总工单数</span>
            </div>
          </van-grid-item>
          <van-grid-item>
            <div class="stat-card card-progress">
              <span class="stat-num">{{ summary.inProgress }}</span>
              <span class="stat-label">进行中</span>
            </div>
          </van-grid-item>
          <van-grid-item>
            <div class="stat-card card-done">
              <span class="stat-num">{{ summary.completed }}</span>
              <span class="stat-label">已完成</span>
            </div>
          </van-grid-item>
          <van-grid-item>
            <div class="stat-card card-error">
              <span class="stat-num">{{ summary.paused + summary.abnormal }}</span>
              <span class="stat-label">异常数</span>
            </div>
          </van-grid-item>
        </van-grid>
      </div>

      <div class="chart-card">
        <div class="chart-title">近7天工单完成趋势</div>
        <v-chart :option="barOption" style="height: 220px" autoresize />
      </div>

      <div class="chart-card">
        <div class="chart-title">工单状态分布</div>
        <v-chart :option="pieOption" style="height: 260px" autoresize />
      </div>

      <div class="chart-card">
        <div class="chart-title">产品产量分布</div>
        <v-chart :option="ringOption" style="height: 260px" autoresize />
      </div>

      <div class="update-time">数据更新时间：{{ updateTime }}</div>
    </template>

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
.loading { display: flex; justify-content: center; padding: 60px; }
.stat-cards { padding: 12px 6px 0; }
.stat-card { border-radius: 10px; padding: 14px 8px; text-align: center; color: #fff; }
.card-total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.card-progress { background: linear-gradient(135deg, #1989fa 0%, #0d6efd 100%); }
.card-done { background: linear-gradient(135deg, #07c160 0%, #0abf53 100%); }
.card-error { background: linear-gradient(135deg, #ff976a 0%, #ee0a24 100%); }
.stat-num { display: block; font-size: 28px; font-weight: bold; line-height: 1.2; }
.stat-label { display: block; font-size: 12px; margin-top: 4px; opacity: 0.9; }
.chart-card { background: #fff; margin: 12px; border-radius: 12px; padding: 16px; }
.chart-title { font-size: 15px; font-weight: 600; color: #333; margin-bottom: 8px; }
.update-time { text-align: center; font-size: 12px; color: #999; padding: 16px; }
</style>
