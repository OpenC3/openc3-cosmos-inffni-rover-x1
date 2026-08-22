import time

set_line_delay(0)

CHANGE_DELTA = 5
CENTER_DELTA = 10
CENTER_VALUE = 128

previous_left_x = -1
previous_left_y = -1
previous_right_x = -1
previous_right_y = -1
previous_button_triangle = 'OFF'
previous_button_square = 'OFF'
previous_button_cross = 'OFF'
previous_button_circle = 'OFF'
previous_button_l1 = 'OFF'
previous_button_l2 = 'OFF'
previous_button_r1 = 'OFF'
previous_button_r2 = 'OFF'
previous_direction = 'NONE'
scaled_left_x = 0
scaled_left_y = 0
scaled_right_x = 0
scaled_right_y = 0
triangle_press = False
square_press = False
cross_press = False
circle_press = False
l1_press = False
l2_press = False
r1_press = False
r2_press = False
up_press = False
down_press = False
left_press = False
right_press = False
stop = True

id = subscribe_packets([['DUALSENSE', 'BTSTATE']])
control_time = time.monotonic()
control_changed = False

while True:
    now = time.monotonic()
    # At least 2Hz commanding
    if control_changed or (now - control_time >= 0.5):
        if stop:
            cmd(f"ROVER SET_JOYSTICK_CONTROL with MOVE_X 0, MOVE_Y 0, TURN_X 0, TURN_Y 0")
        else:
            cmd(f"ROVER SET_JOYSTICK_CONTROL with MOVE_X {scaled_left_x}, MOVE_Y {scaled_left_y}, TURN_X {scaled_right_x}, TURN_Y {scaled_right_y}")
        control_changed = False
        control_time = now
        
    if triangle_press:
        cmd("ROVER LEG_WAVE")
    elif square_press:
        cmd("ROVER LEG_DANCE")
    elif cross_press:
        cmd("ROVER LEG_BEG")
    elif circle_press:
        cmd("ROVER LEG_SWITCH")
    elif l1_press:
        pass
    elif l2_press:
        pass
    elif r1_press:
        pass
    elif r2_press:
        pass
    elif up_press:
        cmd("ROVER LEG_WALK")
    elif down_press:
        cmd("ROVER LEG_RUN")
    elif left_press:
        cmd("ROVER LEG_READY")
    elif right_press:
        cmd("ROVER LEG_CROSS")  

    triangle_press = False
    square_press = False
    cross_press = False
    circle_press = False
    l1_press = False
    l2_press = False
    r1_press = False
    r2_press = False
    up_press = False
    down_press = False
    left_press = False
    right_press = False
    stop = False
    
    id, packets = get_packets(id, block=500, count=1000)
    for packet in packets:
        left_x = packet['LEFT_X']
        left_y = packet['LEFT_Y']
        right_x = packet['RIGHT_X']
        right_y = packet['RIGHT_Y']
    
        left_x_change = abs(left_x - previous_left_x)
        left_y_change = abs(left_y - previous_left_y)
        right_x_change = abs(right_x - previous_right_x)
        right_y_change = abs(right_y - previous_right_y)
    
        if left_x > (CENTER_VALUE - CENTER_DELTA) and left_x < (CENTER_VALUE + CENTER_DELTA) and left_y > (CENTER_VALUE - CENTER_DELTA) and left_y < (CENTER_VALUE + CENTER_DELTA) and right_x > (CENTER_VALUE - CENTER_DELTA) and right_x < (CENTER_VALUE + CENTER_DELTA) and right_y > (CENTER_VALUE - CENTER_DELTA) and right_y < (CENTER_VALUE + CENTER_DELTA):
            stop = True
        elif left_x_change > CHANGE_DELTA or left_y_change > CHANGE_DELTA or right_x_change > CHANGE_DELTA or right_y_change > CHANGE_DELTA:
            control_changed = True
            scaled_left_x = int(((left_x - 128) * 32767) / 128)
            scaled_left_y = -int(((left_y - 128) * 32767) / 128)
            scaled_right_x = int(((right_x - 128) * 32767) / 128)
            scaled_right_y = -int(((right_y - 128) * 32767) / 128)
    
        previous_left_x = left_x
        previous_left_y = left_y
        previous_right_x = right_x
        previous_right_y = right_y
    
        button_triangle = packet['BUTTON_TRIANGLE__C']
        button_square = packet['BUTTON_SQUARE__C']
        button_cross = packet['BUTTON_CROSS__C']
        button_circle = packet['BUTTON_CIRCLE__C']
        button_l1 = packet['BUTTON_L1__C']
        button_l2 = packet['BUTTON_L2__C']
        button_r1 = packet['BUTTON_R1__C']
        button_r2 = packet['BUTTON_R2__C']
        direction = packet['DIRECTION__C']
    
        if button_triangle == 'ON' and previous_button_triangle != 'ON':
            triangle_press = True
        if button_square == 'ON' and previous_button_square != 'ON':
            square_press = True
        if button_cross == 'ON' and previous_button_cross != 'ON':
            cross_press = True
        if button_circle == 'ON' and previous_button_circle != 'ON':
            circle_press = True
        if button_l1 == 'ON' and previous_button_l1 != 'ON':
            l1_press = True
        if button_l2 == 'ON' and previous_button_l2 != 'ON':
            l2_press = True
        if button_r1 == 'ON' and previous_button_r1 != 'ON':
            r1_press = True
        if button_r2 == 'ON' and previous_button_r2 != 'ON':
            r2_press = True
        if direction == 'UP' and previous_direction != 'UP':
            up_press = True
        if direction == 'DOWN' and previous_direction != 'DOWN':
            down_press = True
        if direction == 'LEFT' and previous_direction != 'LEFT':
            left_press = True
        if direction == 'RIGHT' and previous_direction != 'RIGHT':
            right_press = True
    
        previous_button_triangle = button_triangle
        previous_button_square = button_square
        previous_button_cross = button_cross
        previous_button_circle = button_circle
        previous_button_l1 = button_l1
        previous_button_l2 = button_l2
        previous_button_r1 = button_r1
        previous_button_r2 = button_r2
        previous_direction = direction
