import Explainer, { ExplainerPage } from '../explainer/Explainer.jsx'

// Everything below was checked against google/gvisor at this commit.
const COMMIT = 'ab5f509c9c6efd407cbc360ec427b0884329c019'

const CALL = <code>getpid()</code>

const dispatch = {
  path: ['sentry'],
  actor: 'sentry',
  title: 'The Sentry answers it',
  text: (
    <>
      Now it's ordinary Go code. <code>Switch</code> returns "this was a
      syscall", and the task goes <code>doSyscall</code> →{' '}
      <code>executeSyscall</code>, looks up syscall 39 in the Sentry's own
      syscall table, and runs <code>Getpid</code>. That returns the PID from
      the <b>Sentry's</b> process table, not the host's. This step is the same
      on every platform.
    </>
  ),
}

// ---------- systrap ----------

const SYSTRAP_SCENE = {
  width: 640,
  height: 370,
  points: {
    app: [120, 88],
    handler: [120, 190],
    shm: [330, 190],
    sentry: [530, 130],
    seccomp: [120, 315],
  },
  zones: [
    { x: 10, y: 8, w: 620, h: 250, label: 'sandbox', kind: 'dashed' },
    { x: 30, y: 38, w: 190, h: 200, label: 'stub process', kind: 'dashed', activeOn: ['app', 'handler'] },
    { x: 10, y: 282, w: 620, h: 64, label: 'host Linux kernel', kind: 'band', activeOn: ['seccomp'] },
  ],
  dots: [
    { at: 'shm', label: 'shared memory' },
    { at: 'seccomp', label: 'seccomp' },
  ],
  boxes: [
    { id: 'app', x: 50, y: 64, w: 140, h: 48, label: 'App code', sub: 'stub thread' },
    { id: 'handler', x: 50, y: 166, w: 140, h: 48, label: 'sysmsg', sub: 'stub signal handler' },
    { id: 'sentry', x: 455, y: 105, w: 150, h: 50, label: 'Sentry', sub: 'task goroutine' },
  ],
}

const SYSTRAP_STEPS = [
  {
    path: ['app', 'seccomp'],
    actor: 'seccomp',
    count: { trap: 1 },
    title: <>App calls {CALL}</>,
    text: (
      <>
        To the host, the app is an ordinary thread in a <b>stub process</b>{' '}
        (one per app address space, created from the Sentry). When it runs the{' '}
        <code>syscall</code> instruction, the host kernel first checks the
        stub's seccomp filter. The filter returns{' '}
        <code>SECCOMP_RET_TRAP</code>, so the host kernel <b>skips</b>{' '}
        <code>getpid</code> and sends the thread a <code>SIGSYS</code> signal
        instead.
      </>
    ),
  },
  {
    path: ['seccomp', 'handler'],
    actor: 'handler',
    title: 'The signal handler takes over',
    text: (
      <>
        The signal interrupts the app on the <b>same host thread</b> and runs
        the stub's handler, <code>__export_sighandler</code> in{' '}
        <b>sysmsg</b>. It copies the app's registers (the syscall number, its
        arguments, everything) into a <i>context</i> in memory the Sentry can
        also read, and marks it <code>SYSCALL</code>.
      </>
    ),
  },
  {
    path: ['handler', 'shm', 'sentry'],
    actor: 'sentry',
    count: { switch: 1 },
    title: 'Hand off to the Sentry',
    text: (
      <>
        <code>switch_context</code> tells the Sentry there's work. If the
        Sentry is already spinning on that context, that's enough; otherwise it
        wakes it with <code>FUTEX_WAKE</code>. The Sentry's task goroutine was
        waiting in <code>waitOnState</code> and picks it up. The stub thread
        doesn't wait for the answer: it takes the next ready app thread from a
        shared context queue.
      </>
    ),
  },
  dispatch,
  {
    path: ['sentry', 'shm', 'handler'],
    actor: 'handler',
    count: { switch: 1 },
    title: 'The answer goes back',
    text: (
      <>
        The Sentry writes the PID into the app's saved <code>rax</code>{' '}
        register in shared memory and puts the context back on the stub
        process's context queue. Whichever stub thread picks it up next resumes
        the app.
      </>
    ),
  },
  {
    path: ['handler', 'app'],
    actor: 'app',
    title: 'Back to the app',
    text: (
      <>
        The stub thread copies the updated registers into the signal frame and
        calls <code>rt_sigreturn</code>. The host kernel restores those
        registers, so the app continues right after its <code>syscall</code>{' '}
        instruction, holding a PID the host has never heard of.
      </>
    ),
  },
  {
    path: ['app', 'handler', 'shm', 'sentry'],
    actor: 'sentry',
    kind: 'alt',
    count: { trap: 1, switch: 1 },
    title: 'Next time: a shortcut',
    text: (
      <>
        Trapping costs two trips through the host kernel: the signal, then
        returning from it. So after the first trap, <code>PatchSyscall</code>{' '}
        <b>rewrites the app's code</b> at that spot: the 7-byte{' '}
        <code>mov $39,%eax; syscall</code> becomes a 7-byte jump into a trap
        table, which jumps straight to the stub's <code>syshandler</code>. The
        next {CALL} from here never enters the host kernel. This is amd64 only,
        and skipped if the app uses the <code>%gs</code> register or is being
        traced.
      </>
    ),
  },
]

// ---------- KVM ----------

const KVM_SCENE = {
  width: 640,
  height: 370,
  points: {
    app: [130, 88],
    sysenter: [270, 148],
    sentry: [130, 210],
    bluepill: [520, 210],
    kvm: [320, 315],
  },
  zones: [
    { x: 10, y: 8, w: 620, h: 250, label: 'sandbox', kind: 'dashed' },
    { x: 30, y: 38, w: 310, h: 205, label: 'guest mode (KVM VM)', kind: 'dashed', activeOn: ['app', 'sentry', 'sysenter'] },
    { x: 10, y: 282, w: 620, h: 64, label: 'host Linux kernel', kind: 'band', activeOn: ['kvm'] },
  ],
  dots: [
    { at: 'sysenter', label: 'sysenter' },
    { at: 'kvm', label: 'KVM' },
  ],
  boxes: [
    { id: 'app', x: 55, y: 64, w: 150, h: 48, label: 'App code', sub: 'guest ring 3' },
    { id: 'sentry', x: 55, y: 185, w: 150, h: 50, label: 'Sentry', sub: 'guest ring 0' },
    { id: 'bluepill', x: 435, y: 185, w: 170, h: 50, label: 'Sentry host thread', sub: 'bluepill / KVM_RUN loop' },
  ],
}

const KVM_STEPS = [
  {
    path: ['bluepill', 'kvm', 'sentry'],
    actor: 'sentry',
    title: 'The Sentry steps into the VM',
    text: (
      <>
        With KVM, the Sentry runs <b>inside a lightweight virtual machine</b>,
        as that VM's kernel. To get in, a Sentry host thread calls{' '}
        <code>bluepill()</code>, which sets up a signal frame whose handler
        loops on <code>ioctl(KVM_RUN)</code>. The thread then carries on
        running the <b>same Go code</b>, now in guest ring 0 with kernel
        privileges. A thread that's already inside skips this step.
      </>
    ),
  },
  {
    path: ['sentry', 'app'],
    actor: 'app',
    title: 'Jump to the app',
    text: (
      <>
        <code>ring0.SwitchToUser</code> loads the app's page tables (CR3) and
        runs <code>SYSRET64</code> to drop into guest ring 3. Each app address
        space has its own page tables, and the Sentry's memory is mapped into
        the top half of all of them.
      </>
    ),
  },
  {
    path: ['app', 'sysenter'],
    actor: 'sysenter',
    count: { trap: 1 },
    title: <>App calls {CALL}</>,
    text: (
      <>
        The <code>syscall</code> instruction does what it does on any Linux
        machine: the CPU jumps to the kernel's entry point, which the Sentry
        set to <code>sysenter</code> in the guest's <code>LSTAR</code>{' '}
        register. The kernel here is the Sentry, so the call <b>never leaves
        the VM</b>. No seccomp, no signal, no VM exit.
      </>
    ),
  },
  {
    path: ['sysenter', 'sentry'],
    actor: 'sentry',
    title: 'Straight back into the Sentry',
    text: (
      <>
        <code>sysenter</code> saves the app's registers, switches back to the
        Sentry's page tables, and <code>RET</code>s to whoever called{' '}
        <code>SwitchToUser</code>, with vector <code>Syscall</code>. To the
        Sentry it looks like the switch to the app just returned, with the note
        "that was a syscall".
      </>
    ),
  },
  dispatch,
  {
    path: ['sentry', 'app'],
    actor: 'app',
    title: 'Back to the app',
    text: (
      <>
        The Sentry puts the PID in <code>rax</code> and calls{' '}
        <code>SwitchToUser</code> again. The whole round trip stayed inside the
        VM. The host kernel never knew a syscall happened.
      </>
    ),
  },
]

const MODES = {
  systrap: {
    label: 'systrap (default)',
    blurb: (
      <>
        <b>systrap</b> needs no virtualization. App code runs in ordinary host
        processes, and the host kernel's seccomp turns each syscall into a
        signal. Stub code that shares memory with the Sentry handles that
        signal.
      </>
    ),
    steps: SYSTRAP_STEPS,
  },
  kvm: {
    label: 'KVM',
    blurb: (
      <>
        <b>KVM</b> runs the Sentry <i>and</i> the app inside a lightweight VM.
        The Sentry is the guest's kernel, so an app syscall is just a ring 3 →
        ring 0 switch inside the guest.
      </>
    ),
    steps: KVM_STEPS,
  },
}

const SCENES = { systrap: SYSTRAP_SCENE, kvm: KVM_SCENE }

const COUNTERS = [
  { key: 'trap', label: 'app syscalls' },
  { key: 'switch', label: 'stub ↔ Sentry handoffs' },
  { key: 'exit', label: 'VM exits' },
]

export default function GvisorSyscall() {
  return (
    <ExplainerPage title="How a syscall reaches the gVisor kernel">
      <p>
        On a normal Linux machine, <code>getpid()</code> is answered by the host
        kernel. In gVisor, it's answered by the <b>Sentry</b>, a kernel written
        in Go that runs inside the sandbox. The app's syscalls never execute on
        the host. How a syscall gets <i>to</i> the Sentry depends on the{' '}
        <b>platform</b>. Step through one {CALL} on the two main ones.
      </p>

      <Explainer scene={(m) => SCENES[m]} modes={MODES} counters={COUNTERS} />

      <h2>The short version</h2>
      <ul>
        <li>
          <b>The middle is shared.</b> Once the Sentry has the registers, the
          rest is platform-independent: <code>doSyscall</code> →{' '}
          <code>executeSyscall</code> → the syscall table.
        </li>
        <li>
          <b>systrap</b> relies on the host kernel only to <i>catch</i> the
          syscall (seccomp → signal), and even that disappears once the call
          site is patched.
        </li>
        <li>
          <b>KVM</b> makes app syscalls nearly free, because they never leave
          the guest. The cost moves elsewhere: whenever the Sentry itself needs
          the host kernel, it has to leave the VM.
        </li>
        <li>
          <code>--platform=auto</code> prefers KVM, then systrap. It skips KVM
          inside a VM (that would need nested virtualization) and for NVIDIA
          GPU workloads.
        </li>
      </ul>

      <p className="sources">
        Checked against gVisor at{' '}
        <a href={`https://github.com/google/gvisor/tree/${COMMIT}`}>{COMMIT.slice(0, 7)}</a>{' '}
        (Nov 2026)
      </p>
    </ExplainerPage>
  )
}
