export function Button({
  children,
  className = "",
  icon,
  iconPosition = "start",
  size = "md",
  variant = "secondary",
  ...props
}) {
  const classes = [
    "ui-button",
    `is-${variant}`,
    `is-${size}`,
    className,
  ].filter(Boolean).join(" ");

  const iconNode = icon ? (
    <span className="ui-button-icon" aria-hidden="true">{icon}</span>
  ) : null;

  return (
    <button className={classes} type="button" {...props}>
      {iconPosition === "start" ? iconNode : null}
      {children !== undefined && children !== null ? <span className="ui-button-label">{children}</span> : null}
      {iconPosition === "end" ? iconNode : null}
    </button>
  );
}
