<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    title,
    confirmLabel,
    onconfirm,
    children,
  }: { open?: boolean; title: string; confirmLabel: string; onconfirm: () => void; children: Snippet } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  // A native modal: backdrop, focus trap and Esc come with it, and it sits above the map.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function confirm() {
    open = false;
    onconfirm();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialog}
  aria-labelledby="confirm-title"
  onclose={() => (open = false)}
  onclick={(e) => {
    // A click on the backdrop lands on the dialog itself.
    if (e.target === dialog) open = false;
  }}
>
  <div class="body">
    <h2 id="confirm-title">{title}</h2>
    <div class="msg">{@render children()}</div>
    <div class="actions">
      <!-- svelte-ignore a11y_autofocus -->
      <button class="btn" autofocus onclick={() => (open = false)}>Cancel</button>
      <button class="btn destructive" onclick={confirm}>{confirmLabel}</button>
    </div>
  </div>
</dialog>

<style>
  dialog {
    width: min(400px, calc(100vw - 32px));
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 20px 16px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  .msg {
    font-size: 14px;
    color: var(--text-2);
  }
  .msg :global(p) {
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
  .destructive {
    background: var(--critical);
    border-color: transparent;
    color: #fff;
  }
  .destructive:hover {
    background: var(--critical);
    filter: brightness(1.08);
  }
</style>
