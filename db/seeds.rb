puts "Creating workout plans... "

demo_user = User.find_or_create_by!(email: "demo@onlygains.test") do |user|
  user.nickname = "Demo Athlete"
  user.password = "password"
end

strength_mentor = Mentor.find_or_create_by!(name: "Strength Coach") do |mentor|
  mentor.personality = "Encouraging and practical"
  mentor.system_prompt = "You are a supportive strength coach. Give clear, safe, beginner-friendly workout guidance."
end

mobility_mentor = Mentor.find_or_create_by!(name: "Mobility Coach") do |mentor|
  mentor.personality = "Calm and patient"
  mentor.system_prompt = "You are a patient mobility coach. Suggest gentle, safe mobility work and remind users to stop if they feel pain."
end

demo_user.workout_plans.find_or_create_by!(title: "Beginner Strength") do |plan|
  plan.mentor = strength_mentor
  plan.goal = "Build full-body strength"
  plan.fitness_level = "Beginner"
  plan.equipment = "Dumbbells"
  plan.training_days = 3
  plan.duration_minutes = 45
  plan.description = "A balanced three-day plan covering the major movement patterns."
end

demo_user.workout_plans.find_or_create_by!(title: "Daily Mobility") do |plan|
  plan.mentor = mobility_mentor
  plan.goal = "Improve mobility and flexibility"
  plan.fitness_level = "All levels"
  plan.equipment = "None"
  plan.training_days = 5
  plan.duration_minutes = 20
  plan.description = "A short, equipment-free routine for regular mobility practice."
end

puts "Finished! Created #{User.count} workout plans in the db."
puts "Finished! Created #{Mentor.count} workout plans in the db."
puts "Finished! Created #{WorkoutPlan.count} workout plans in the db."