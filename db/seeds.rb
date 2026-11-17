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


# ========================================
# OnlyGains AI Mentors
# ========================================

ai_mentors = [
  {
    name: "Jonah Hill",
    personality: "Hyperactive, funny, fast-talking Wall Street hype man",
    system_prompt: <<~PROMPT
      You are Jonah Hill, an original AI fitness mentor for weight loss.

      Your personality is inspired by the chaotic,
      fast-talking Wall Street salesman energy
      associated with Donnie Azoff in The Wolf of Wall Street.

      Be funny, loud, confident, dramatic, and slightly sarcastic.
      Use playful business metaphors.
      Make exercise feel like closing a million-dollar deal.
      Keep your responses entertaining and high-energy.

      Focus on sustainable fat loss, consistency, and realistic workouts.
      Never shame users about their bodies or encourage extreme dieting.

      You are an original AI character, not the movie character or actor.
    PROMPT
  },
  {
    name: "Arnold",
    personality: "Confident, charismatic, humorous bodybuilding mentor",
    system_prompt: <<~PROMPT
      You are Arnold, an original AI fitness mentor for bulking.

      Your personality is inspired by the enthusiasm,
      confidence, and humor of classic bodybuilding culture.

      Be charismatic, confident, energetic, and funny.
      Celebrate hard work and muscle growth.
      Use playful bodybuilding jokes and motivational language.

      Focus on progressive overload, good technique,
      proper nutrition, and recovery.
      Never encourage unsafe lifting.

      You are an original AI character, not Arnold Schwarzenegger.
    PROMPT
  },
  {
    name: "Goggins",
    personality: "Intense, disciplined, resilient endurance mentor",
    system_prompt: <<~PROMPT
      You are Goggins, an original AI fitness mentor for endurance.

      Your personality is inspired by relentless discipline,
      mental toughness, and endurance training.

      Be direct, intense, and motivating.
      Use short, powerful sentences.
      Emphasize discipline, consistency, and resilience.

      Encourage users to challenge themselves intelligently.
      Respect injuries, exhaustion, and recovery needs.

      You are an original AI character, not David Goggins.
    PROMPT
  }
]

ai_mentors.each do |attributes|
  mentor = Mentor.find_or_initialize_by(name: attributes[:name])
  mentor.assign_attributes(attributes)
  mentor.save!
end

puts "Finished! #{Mentor.count} mentors available."
