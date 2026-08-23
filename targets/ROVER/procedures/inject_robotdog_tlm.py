# Simulate GET_PROTOCOL_EXCHANGE_RESPONSE so the ROBOTDOG screen animates
# without a rover attached. Run from Script Runner:
#
#   ROVER/procedures/inject_robotdog_tlm.py
#
# It writes a slow crouch: all four legs squat and stand together on a 20 s
# cycle with the body held level (no roll/pitch/yaw), plus drifting motor
# temperatures, bus voltages and cell voltages.
#
# NOTE: this uses set_tlm, not inject_tlm. inject_tlm asks the interface
# microservice to re-encode the whole packet, and this packet uses
# json_accessor - with no rover attached its buffer is empty, so the encode
# fails with "unexpected character: line 1 column 1 (char 0)". set_tlm writes
# the current value table directly, which is all the screen reads.
# Values are overwritten by real telemetry if the interface is connected.

import math
import time

TARGET = "ROVER"
PACKET = "GET_PROTOCOL_EXCHANGE_RESPONSE"

DURATION = 120.0  # seconds to run, set to 0 to run until stopped
RATE = 5.0  # joint updates per second
SLOW_PERIOD = 1.0  # seconds between temperature / battery / timestamp updates

# Crouch envelope. c = 0 is standing tall, c = 1 is fully squatted: the hip
# swings the thigh further aft while the knee folds the calf further forward,
# which drops the body straight down.
HIP_STAND = 0.25
HIP_CROUCH = 0.80
KNEE_STAND = -0.65
KNEE_CROUCH = -1.70
# Standing abduction, as the rover actually reports it: about 0.40 rad on the
# front legs and 0.68 on the rear (see docs/http_captures). The widget subtracts
# these offsets, so reproducing them keeps the render upright.
ABD_FRONT = 0.40
ABD_REAR = 0.68
CROUCH_PERIOD = 20.0  # seconds for one full down-and-up cycle

# The rover reports the starboard legs with inverted abduction and the rear
# legs with inverted pitch; the widget undoes both (SETTING MIRROR_RIGHT /
# MIRROR_REAR). Reproduce those signs here so the data looks like the real
# telemetry rather than the visualization.
LEGS = [
    # name,          side (-1 port/+1 stbd), end (+1 front/-1 rear)
    ("LEFT_FRONT", -1, 1),
    ("RIGHT_FRONT", 1, 1),
    ("LEFT_REAR", -1, -1),
    ("RIGHT_REAR", 1, -1),
]


def crouch(t):
    """0 (standing) to 1 (squatted), one smooth cycle every CROUCH_PERIOD."""
    return 0.5 - 0.5 * math.cos(2.0 * math.pi * t / CROUCH_PERIOD)


def leg_angles(side, end, t):
    """Return the 4 element q array [abduction, hip, knee, wheel] for one leg.

    All four legs share the same crouch, so the body stays level as it drops.
    """
    c = crouch(t)
    hip = HIP_STAND + (HIP_CROUCH - HIP_STAND) * c
    knee = KNEE_STAND + (KNEE_CROUCH - KNEE_STAND) * c
    abd = ABD_FRONT if end > 0 else ABD_REAR
    # Wheels are parked while crouching
    return [-side * abd, end * hip, end * knee, 0.0]


def motor_temps(index, t):
    base = 23 + index * 2
    return [
        round(base + 25 * max(0.0, math.sin(t / 7.0 + index))),
        round(base + 3 * math.sin(t / 5.0 + index)),
        base + 2,
        base,
    ]


def write(item, value):
    # ALL writes the RAW, CONVERTED and FORMATTED entries. The screen asks for
    # whichever type the item actually has, so set them all.
    set_tlm(TARGET, PACKET, item, value, type="ALL")


# State 21 is LEG_CROSS in LEG mode and WHEEL_READY in WHEEL mode, so look up
# whichever name this installation defines.
STATES = get_item(TARGET, PACKET, "CURRENT_STATE")["states"]
MOVING_STATE = next(
    # Each state is {'value': <number>} but tolerate a bare number as well
    (
        name
        for name, state in STATES.items()
        if (state["value"] if isinstance(state, dict) else state) == 21
    ),
    None,
)

# Anything that does not animate is written once up front. Every set_tlm is a
# separate call, so keeping the per-tick set small is what makes the four legs
# move together instead of stepping one after another.
for index, (name, side, end) in enumerate(LEGS):
    write(f"{name}_BUS_V", [56, 56, 55, 55])
    write(f"{name}_ERROR_CODE", [0, 0, 0, 0])
write("RPY_0", 0.0)
write("RPY_1", 0.0)
write("RPY_2", 0.0)
# Level attitude: identity quaternion in the rover frame, [w, x, y, z]
write("Q_0", 1.0)
write("Q_1", 0.0)
write("Q_2", 0.0)
write("Q_3", 0.0)
write("PACKV", 56)
write("VTOP", 57)
write("CELLS_VOLTAGE", [3980, 3975, 3990, 3968, 3985])
write("SEARCH_LIGHT_STATE", True)
write("EMERGENCY_STOP", False)
set_tlm(TARGET, PACKET, "CURRENT_STATE", 21, type="RAW")
if MOVING_STATE:
    set_tlm(TARGET, PACKET, "CURRENT_STATE", MOVING_STATE, type="CONVERTED")
    set_tlm(TARGET, PACKET, "CURRENT_STATE", MOVING_STATE, type="FORMATTED")

start = time.time()
t = 0.0
slow = -SLOW_PERIOD  # forces the first slow pass immediately
print(f"Simulating {TARGET} {PACKET} at {RATE} Hz - open the robotdog screen")
while DURATION == 0 or t < DURATION:
    t = time.time() - start

    # Fast path: the four joint arrays, written back to back so one crouch
    # reaches every leg within a few milliseconds of the others
    for name, side, end in LEGS:
        write(f"{name}_Q", leg_angles(side, end, t))

    # get_tlm_values compares now - RECEIVED_TIMESECONDS to decide staleness and
    # raises "nil can't be coerced into Float" if it was never set, which 500s
    # the whole screen. A real packet sets these; here we have to.
    now = time.time()
    write("RECEIVED_TIMESECONDS", now)
    write("PACKET_TIMESECONDS", now)
    write("RECEIVED_COUNT", round(t * RATE) + 1)

    # Slow path: temperatures, battery and the time strings drift slowly enough
    # that once a second is plenty
    if t - slow >= SLOW_PERIOD:
        slow = t
        for index, (name, side, end) in enumerate(LEGS):
            temps = motor_temps(index, t)
            write(f"{name}_MOTOR_TEMP", temps)
            write(f"{name}_MOS_TEMP", [temp - 6 for temp in temps])
            write(f"{name}_MCU_TEMP", [temp - 10 for temp in temps])
        write("IMU_TEMP", 41.5 + math.sin(t / 9.0))
        write("BATTERY_LEVEL", max(0, round(88 - t / 30.0)))
        stamp = time.strftime("%Y/%m/%d %H:%M:%S", time.gmtime(now))
        write("PACKET_TIMEFORMATTED", stamp)
        write("RECEIVED_TIMEFORMATTED", stamp)

    wait(1.0 / RATE)

print("Simulation complete")
