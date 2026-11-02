import { Button } from "@acme/design/controls";
export const Page = ({ props, tone }: { props: Record<string, unknown>; tone: string }) => <><Button {...props} /><div className={tone}>Acme</div></>;
