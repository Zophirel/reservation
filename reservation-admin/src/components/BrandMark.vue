<template>
  <div class="brand-mark" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
</template>

<style scoped>
.brand-mark {
  display: grid;
  grid-template-columns: repeat(3, 7px);
  align-items: end;
  gap: 3px;
  width: 29px;
  height: 29px;
  padding: 5px;
  border-radius: 9px;
  color: white;
  background: var(--ink);
}

span { display: block; border-radius: 4px; background: currentColor; }
span:nth-child(1) { height: 8px; }
span:nth-child(2) { height: 14px; }
span:nth-child(3) { height: 11px; }
</style>
