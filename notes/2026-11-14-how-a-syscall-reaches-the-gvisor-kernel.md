---
title: How a syscall reaches the gVisor kernel
date: 2026-11-14
tags: [gvisor 101]
link: /gvisor-syscall/
---
Follow one `getpid()` from the app to gVisor's Sentry and back, on **systrap**
(seccomp trap → signal handler → shared memory) and on **KVM** (a ring 3 → ring 0
switch inside the guest, with no VM exit).

Either way, the answer comes from the Sentry's own process table. The host
kernel never runs the syscall.
