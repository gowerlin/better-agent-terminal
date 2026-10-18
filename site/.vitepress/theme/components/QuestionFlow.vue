<template>
  <!-- Worker 問塔台的流程：塔台代答或轉給你；提問通道用不了時改走工單 -->
  <figure class="question-flow" aria-label="Worker 問塔台的流程">
    <ol class="qf-main">
      <li class="qf-box is-worker">
        <p class="qf-who">Codex CLI · Worker · T1025</p>
        <p class="qf-text">金額四捨五入還是無條件捨去？</p>
        <p class="qf-state"><span aria-hidden="true">?</span> 在等塔台答覆</p>
      </li>
      <li class="qf-box is-tower">
        <p class="qf-who">塔台</p>
        <p class="qf-text">這在工單範圍內嗎？專案有慣例嗎？</p>
      </li>
    </ol>
    <ul class="qf-branches">
      <li class="qf-branch is-tower">
        <p class="qf-when">範圍內的技術選擇</p>
        <p class="qf-text">塔台直接回答，並在工單裡記下理由。</p>
        <p class="qf-then">Worker 收到答覆，接著做。</p>
      </li>
      <li class="qf-branch is-you">
        <p class="qf-when">需要你決定的事</p>
        <p class="qf-text">商業規則、範圍變更、你的偏好：塔台停下來問你。</p>
        <p class="qf-then">你回答後，塔台把答覆轉給 Worker。</p>
      </li>
    </ul>
    <p class="qf-fallback">
      <b>提問通道用不了時</b>（例如 BAT 版本太舊，或 BAT 重開讓問題消失），Worker 改把問題寫進工單、通知塔台，塔台也在工單裡答覆。等太久沒有答案，Worker 會把工單標成需要協助，交回塔台。
    </p>
  </figure>
</template>
