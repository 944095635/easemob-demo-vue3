<script setup lang="ts">
/**
 * 联系人详情底部操作区：替换 UIKit EmContactDetail 内置的「拉黑 / 删除联系人」按钮。
 *
 * UIKit 内置删除走环信 SDK deleteContact；这里按 App（Flutter UserInfoPage）的流程
 * 改为自有服务 DELETE /api/friend/{userId}，成功后清本地好友 + 删会话（保留消息）。
 * 仍保留拉黑入口，避免覆盖 #footer 后丢失原有能力。
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { EmModal, useContact, useToast } from '@easemob-community/uikit-im'

import { useContactDelete } from '@/composables/useContactDelete'

defineOptions({ name: 'ContactActions' })

const props = defineProps<{
  userId: string
  blocked: boolean
}>()

const emit = defineEmits<{
  deleted: [userId: string]
  blockChanged: [userId: string, blocked: boolean]
}>()

const { t } = useI18n()
const { error: showError } = useToast()
const { addToBlocklist, removeFromBlocklist } = useContact()
const { deleteContact } = useContactDelete()

const deleteModalVisible = ref(false)
const deleting = ref(false)
const blocking = ref(false)

async function toggleBlock() {
  if (blocking.value) return
  blocking.value = true
  const nextBlocked = !props.blocked
  try {
    if (nextBlocked) {
      await addToBlocklist([props.userId])
    } else {
      await removeFromBlocklist([props.userId])
    }
    emit('blockChanged', props.userId, nextBlocked)
  } catch (error) {
    showError(error instanceof Error ? error.message : t('contacts.deleteFriend.failed'))
  } finally {
    blocking.value = false
  }
}

async function confirmDelete() {
  if (deleting.value) return
  deleting.value = true
  try {
    const ok = await deleteContact(props.userId)
    if (ok) emit('deleted', props.userId)
  } finally {
    deleteModalVisible.value = false
    deleting.value = false
  }
}
</script>

<template>
  <div class="contact-actions">
    <button
      type="button"
      class="contact-actions__btn"
      :disabled="blocking || deleting"
      @click="toggleBlock"
    >
      {{ blocked ? t('contacts.deleteFriend.unblock') : t('contacts.deleteFriend.block') }}
    </button>
    <button
      type="button"
      class="contact-actions__btn contact-actions__btn--danger"
      :disabled="blocking || deleting"
      @click="deleteModalVisible = true"
    >
      {{ t('contacts.deleteFriend.action') }}
    </button>

    <EmModal
      v-model:show="deleteModalVisible"
      :title="t('contacts.deleteFriend.title')"
      :confirm-text="t('contacts.deleteFriend.confirmButton')"
      type="danger"
      @confirm="confirmDelete"
      @cancel="deleteModalVisible = false"
    >
      <p class="contact-actions__tip">{{ t('contacts.deleteFriend.confirm') }}</p>
    </EmModal>
  </div>
</template>

<style lang="scss" scoped>
.contact-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 64px;

  &__btn {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    font-size: var(--uikit-font-size-13, 13px);
    color: var(--uikit-text-primary, #171a1c);
    cursor: pointer;
    background-color: var(--uikit-bg-secondary, #f2f3f5);
    border: none;
    border-radius: 999px;

    &:hover:not(:disabled) {
      opacity: 0.85;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    &--danger {
      color: var(--color-danger, #f53f3f);
    }
  }

  &__tip {
    margin: 0;
    font-size: calc(14px * var(--demo-font-scale, 1));
    line-height: 1.5;
    color: var(--color-text-secondary);
  }
}

@media (max-width: 768px) {
  .contact-actions {
    margin-top: 32px;
  }
}
</style>
