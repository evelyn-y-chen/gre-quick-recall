"use client";

type RevealControlsProps = {
  total: number;
  shown: number;
  hidden?: number;
  showLabel?: string;
  hideLabel?: string;
  onShow: () => void;
  onHide: () => void;
};

export default function RevealControls({
  total,
  shown,
  hidden = total - shown,
  showLabel = "显示当前释义",
  hideLabel = "隐藏全部释义",
  onShow,
  onHide,
}: RevealControlsProps) {
  const allShown = total > 0 && shown === total;
  const allHidden = total > 0 && hidden === total;
  return <div className="revealControls" role="group" aria-label={`${showLabel} / ${hideLabel}`}>
    <button type="button" aria-pressed={allShown} disabled={!total} onClick={onShow}>{showLabel}</button>
    <button type="button" aria-pressed={allHidden} disabled={!total} onClick={onHide}>{hideLabel}</button>
    <span className="revealStatus" role="status">{!total ? "当前范围没有词条" : allShown ? "已全部显示" : allHidden ? "已全部隐藏" : "部分已显示"}</span>
  </div>;
}
