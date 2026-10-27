// 쇼케이스 무대를 밀어서 넘기기: 손가락·마우스를 따라 화면 줄이 움직이고, 40px 넘게 밀면 다음·이전 화면으로 간다.
const SWIPE_PX = 40;

/** stage: 미는 곳, track: 움직일 줄. index(): 지금 화면 번호, go(i): 그 화면으로, start(): 손을 댔을 때 */
export function swipe(stage, track, { index, go, start }) {
  let x0 = null;
  let dx = 0;
  stage.addEventListener('pointerdown', (e) => {
    start();
    if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
    x0 = e.clientX;
    dx = 0;
    track.classList.add('is-drag');
  });
  stage.addEventListener('pointermove', (e) => {
    if (x0 == null) return;
    dx = e.clientX - x0;
    track.style.transform = `translateX(calc(${-100 * index()}% + ${dx}px))`;
  });
  const end = () => {
    if (x0 == null) return;
    x0 = null;
    track.classList.remove('is-drag');
    go(Math.abs(dx) > SWIPE_PX ? index() + (dx < 0 ? 1 : -1) : index());
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('pointerleave', end);
}
