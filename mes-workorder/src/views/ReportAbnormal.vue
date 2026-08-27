<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast, showSuccessToast } from 'vant'
import { api, type OrderItem } from '@/api'

const route = useRoute()
const router = useRouter()
const orders = ref<OrderItem[]>([])

const abnormalTypes = ['设备故障', '质量问题', '物料短缺', '操作失误', '其他']

const form = ref({
  orderNo: '',
  abnormalType: '',
  description: '',
  urgency: '中',
  images: [] as any[],
})

const showOrderPicker = ref(false)
const showTypePicker = ref(false)

const orderColumns = computed(() =>
  orders.value.map(o => ({
    text: `${o.orderNo} - ${o.productName}`,
    value: o.orderNo,
  }))
)

const typeColumns = computed(() =>
  abnormalTypes.map(t => ({ text: t, value: t }))
)

const urgencyOptions = ['低', '中', '高']

const selectedOrderText = computed(() => {
  if (!form.value.orderNo) return ''
  const order = orders.value.find(o => o.orderNo === form.value.orderNo)
  return order ? `${order.orderNo} - ${order.productName}` : ''
})

const selectedTypeText = computed(() => form.value.abnormalType)

const rules = {
  orderNo: [{ required: true, message: '请选择工单号' }],
  abnormalType: [{ required: true, message: '请选择异常类型' }],
  description: [
    { required: true, message: '请填写异常描述' },
    { validator: (val: string) => val.length >= 5, message: '描述至少5个字符' },
  ],
  urgency: [{ required: true, message: '请选择紧急程度' }],
}

const onOrderConfirm = ({ selectedValues }: any) => {
  form.value.orderNo = selectedValues[0]
  showOrderPicker.value = false
}

const onTypeConfirm = ({ selectedValues }: any) => {
  form.value.abnormalType = selectedValues[0]
  showTypePicker.value = false
}

const afterRead = (file: any) => {
  file.status = 'uploading'
  file.message = '上传中...'
  setTimeout(() => {
    file.status = 'done'
    file.message = ''
  }, 2000)
}

const onDelete = () => {}

const onSubmit = async () => {
  try {
    const order = orders.value.find(o => o.orderNo === form.value.orderNo)
    if (order) {
      await api.createAlert({
        deviceId: order.id,
        deviceName: order.productName,
        alertType: form.value.abnormalType,
        level: form.value.urgency === '高' ? 'error' : 'warning',
      })
    }
    showSuccessToast('提交成功')
    setTimeout(() => router.back(), 1000)
  } catch (e: any) {
    showToast('提交失败: ' + e.message)
  }
}

onMounted(async () => {
  try {
    orders.value = await api.getOrders()
    const orderId = route.query.orderId as string
    if (orderId) {
      const found = orders.value.find(o => o.orderNo === orderId)
      if (found) form.value.orderNo = found.orderNo
    }
  } catch (e: any) {
    showToast('加载工单失败: ' + e.message)
  }
})
</script>

<template>
  <div class="page">
    <van-nav-bar title="异常上报" left-arrow @click-left="router.back()" />

    <van-form @submit="onSubmit">
      <div class="section">
        <div class="section-title">工单信息</div>
        <van-cell-group inset :border="false">
          <van-field
            v-model="selectedOrderText"
            label="工单号"
            placeholder="请选择工单号"
            readonly
            is-link
            :rules="rules.orderNo"
            @click="showOrderPicker = true"
          />
        </van-cell-group>
      </div>

      <div class="section">
        <div class="section-title">异常信息</div>
        <van-cell-group inset :border="false">
          <van-field
            v-model="selectedTypeText"
            label="异常类型"
            placeholder="请选择异常类型"
            readonly
            is-link
            :rules="rules.abnormalType"
            @click="showTypePicker = true"
          />

          <van-field
            v-model="form.description"
            label="异常描述"
            type="textarea"
            placeholder="请详细描述异常情况"
            rows="4"
            autosize
            maxlength="200"
            show-word-limit
            :rules="rules.description"
          />

          <van-field label="异常图片">
            <template #input>
              <van-uploader
                v-model="form.images"
                :max-count="3"
                :after-read="afterRead"
                :deletable="true"
                @delete="onDelete"
              />
            </template>
          </van-field>

          <van-field label="紧急程度" :rules="rules.urgency">
            <template #input>
              <van-radio-group v-model="form.urgency" direction="horizontal">
                <van-radio v-for="opt in urgencyOptions" :key="opt" :name="opt">{{ opt }}</van-radio>
              </van-radio-group>
            </template>
          </van-field>
        </van-cell-group>
      </div>

      <div class="btn-area">
        <van-button round block type="primary" native-type="submit" size="large">
          提交上报
        </van-button>
      </div>
    </van-form>

    <van-popup v-model:show="showOrderPicker" round position="bottom">
      <van-picker
        :columns="orderColumns"
        @confirm="onOrderConfirm"
        @cancel="showOrderPicker = false"
      />
    </van-popup>

    <van-popup v-model:show="showTypePicker" round position="bottom">
      <van-picker
        :columns="typeColumns"
        @confirm="onTypeConfirm"
        @cancel="showTypePicker = false"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 140px;
}

.section {
  margin-top: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  padding: 12px 16px 8px;
}

.btn-area {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
}
</style>
