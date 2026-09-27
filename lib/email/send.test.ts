import { sendMagicLinkEmail } from './send';
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
