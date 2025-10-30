export async function sendDuesReminder({
    toEmail,
    userName,
    groupName,
    unpaidCount,
}: {
    toEmail: string;
    userName: string;
    groupName: string;
    unpaidCount: number;
}): Promise<void> {
    // 실제 이메일/SMS 연동 대신 서버 로그로 대체
    // 연동 시 AWS SES, Slack, SMS 등 구현
    // eslint-disable-next-line no-console
    console.log(
        `[REMINDER] to=${toEmail} name=${userName} group=${groupName} unpaid=${unpaidCount}`
    );
}
