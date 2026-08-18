from collections import Counter

set_line_delay(0)

debounce_state = {}
def debounce(name, value):
  state = debounce_state.get(name)
  if state is not None:
    state.append(value)
    if len(state) > 3:
      state.pop(0)
  else:
    debounce_state[name] = [value]
    state = debounce_state[name]
  result = Counter(state).most_common(1)[0][0]
  return result

previous_left_x = -1
previous_left_y = -1
previous_right_x = -1
previous_right_y = -1
id = subscribe_packets([['DUALSENSE', 'BTSTATE']])
while True:
  id, packets = get_packets(id, block=500, count=1000)
  for packet in packets:
    left_x = packet['LEFT_X']
    left_y = packet['LEFT_Y']
    right_x = packet['RIGHT_X']
    right_y = packet['RIGHT_Y']

    if left_x != previous_left_x or left_y != previous_left_y or right_x != previous_right_x or right_y != previous_right_y:
      scaled_left_x = ((left_x - 128) * 32767) / 128
      scaled_left_y = -((left_y - 128) * 32767) / 128
      scaled_right_x = ((right_x - 128) * 32767) / 128
      scaled_right_x = ((right_y - 128) * 32767) / 128
      cmd(f"ROVER SET_JOYSTICK_CONTROL with MOVE_X {scaled_left_x}, MOVE_Y {scaled_left_y}, TURN_X {scaled_right_x}, TURN_Y 0")

    previous_left_x = left_x
    previous_left_y = left_y
    previous_right_x = right_x
    previous_right_y = right_y

    button_triangle = debounce('BUTTON_TRIANGLE', packet['BUTTON_TRIANGLE__C'])
    button_square = debounce('BUTTON_SQUARE', packet['BUTTON_SQUARE__C'])
    button_cross = debounce('BUTTON_CROSS', packet['BUTTON_CROSS__C'])
    button_circle = debounce('BUTTON_CIRCLE', packet['BUTTON_CIRCLE__C'])
    button_l1 = debounce('BUTTON_L1', packet['BUTTON_L1__C'])
    button_l2 = debounce('BUTTON_L2', packet['BUTTON_L2__C'])
    button_r1 = debounce('BUTTON_R1', packet['BUTTON_R1__C'])
    button_r2 = debounce('BUTTON_R2', packet['BUTTON_R2__C'])
    direction = debounce('DIRECTION', packet['DIRECTION__C'])

    if button_triangle == 'ON' and previous_button_triangle != 'ON':
      cmd_no_range_check("ROVER LEG_WAVE")
    if button_square == 'ON' and previous_button_square != 'ON':
      cmd_no_range_check("ROVER LEG_DANCE") # Dance
    if button_cross == 'ON' and previous_button_cross != 'ON':
      cmd_no_range_check("ROVER LEG_BEG") # Wave
    if button_circle == 'ON' and previous_button_circle != 'ON':
      cmd_no_range_check("ROVER LEG_SWITCH")
    if direction == 'UP' and previous_direction != 'UP':
      cmd_no_range_check("ROVER LEG_WALK")
    if direction == 'DOWN' and previous_direction != 'DOWN':
      cmd_no_range_check("ROVER LEG_RUN")
    if direction == 'LEFT' and previous_direction != 'LEFT':
      cmd_no_range_check("ROVER LEG_READY")
    if direction == 'RIGHT' and previous_direction != 'RIGHT':
      cmd_no_range_check("ROVER LEG_CROSS")

    previous_button_triangle = button_triangle
    previous_button_square = button_square
    previous_button_cross = button_cross
    previous_button_circle = button_circle
    previous_button_l1 = button_l1
    previous_button_l2 = button_l2
    previous_button_r1 = button_r1
    previous_button_r2 = button_r2
    previous_direction = direction
