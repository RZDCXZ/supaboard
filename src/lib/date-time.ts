export function formatFullDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelativeDateTime(value: string) {
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;

  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
