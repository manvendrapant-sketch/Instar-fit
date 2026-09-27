import { sendDunningEmail, sendMagicLinkEmail } from './send';
import { getResend } from './resend';

jest.mock('./resend');

function mockSend() {
  const send = jest.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });
  (getResend as jest.Mock).mockReturnValue({ emails: { send } });
  return send;
}

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
});

describe('sendMagicLinkEmail', () => {
  it('sends to the given address with the login link in the body', async () => {
    const send = mockSend();

    await sendMagicLinkEmail('client@example.com', 'https://instar-fit.vercel.app/api/client/login/verify?token=abc', 'Maya Reyes');

    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0][0];
    expect(call.to).toBe('client@example.com');
    expect(call.subject).toMatch(/log in/i);
    expect(call.html).toContain('https://instar-fit.vercel.app/api/client/login/verify?token=abc');
    expect(call.html).toContain('Maya Reyes');
  });

  it('uses EMAIL_FROM when set, otherwise the Resend sandbox sender', async () => {
    const send = mockSend();
    process.env.EMAIL_FROM = 'Instar <hello@instar.co>';

    await sendMagicLinkEmail('client@example.com', 'https://x/y', 'Maya Reyes');

    expect(send.mock.calls[0][0].from).toBe('Instar <hello@instar.co>');
  });

  it('escapes the coach display name in the email body', async () => {
    const send = mockSend();

    await sendMagicLinkEmail('client@example.com', 'https://x/y', '<script>alert(1)</script>');

    expect(send.mock.calls[0][0].html).not.toContain('<script>alert(1)</script>');
    expect(send.mock.calls[0][0].html).toContain('&lt;script&gt;');
  });
});

describe('sendDunningEmail', () => {
  it('sends a "payment did not go through" subject/body for reason=failed', async () => {
    const send = mockSend();

    await sendDunningEmail('client@example.com', 'https://x/y', 'Maya Reyes', 'Monthly Coaching', 'failed');

    const call = send.mock.calls[0][0];
    expect(call.to).toBe('client@example.com');
    expect(call.subject).toMatch(/didn.{1,10}t go through/i);
    expect(call.html).toContain('https://x/y');
    expect(call.html).toContain('Maya Reyes');
    expect(call.html).toContain('Monthly Coaching');
  });

  it('sends a "needs one more step" subject for reason=action_required', async () => {
    const send = mockSend();

    await sendDunningEmail('client@example.com', 'https://x/y', 'Maya Reyes', 'Monthly Coaching', 'action_required');

    expect(send.mock.calls[0][0].subject).toMatch(/one more step/i);
  });

  it('escapes the offer name and coach display name', async () => {
    const send = mockSend();

    await sendDunningEmail('client@example.com', 'https://x/y', '<b>Maya</b>', '<i>Plan</i>', 'failed');

    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain('<b>Maya</b>');
    expect(html).not.toContain('<i>Plan</i>');
  });

  it('uses EMAIL_FROM when set, otherwise the Resend sandbox sender', async () => {
    const send = mockSend();
    process.env.EMAIL_FROM = 'Instar <hello@instar.co>';

    await sendDunningEmail('client@example.com', 'https://x/y', 'Maya Reyes', 'Plan', 'failed');

    expect(send.mock.calls[0][0].from).toBe('Instar <hello@instar.co>');
  });
});
