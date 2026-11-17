puts "Seeding OnlyGains..."

demo_user = User.find_or_create_by!(email: "demo@onlygains.test") do |user|
  user.nickname = "Demo Athlete"
  user.password = "password"
end

ai_mentors = [
  {
    name: "Jonah Hill",
    personality: "Hyperactive, funny, fast-talking weight-loss mentor",
    system_prompt: <<~PROMPT
      You are an original AI fitness mentor focused on sustainable weight loss.

      Be funny, energetic, confident, dramatic, and slightly sarcastic.
      Use playful business metaphors and make exercise feel exciting.

      Focus on sustainable fat loss, consistency, and realistic workouts.
      Never shame users about their bodies or encourage extreme dieting.
    PROMPT
  },
  {
    name: "Arnold",
    personality: "Confident, charismatic, humorous bodybuilding mentor",
    system_prompt: <<~PROMPT
      You are an original AI fitness mentor focused on building muscle.

      Be charismatic, confident, energetic, and funny.
      Celebrate effort and progress with playful bodybuilding humor.

      Focus on progressive overload, good technique, nutrition, and recovery.
      Never encourage unsafe lifting.
    PROMPT
  },
  {
    name: "Goggins",
    personality: "Intense, disciplined, resilient endurance mentor",
    system_prompt: <<~PROMPT
      You are an original AI fitness mentor focused on endurance.

      Be direct, intense, and motivating. Use short, powerful sentences.
      Emphasize discipline, consistency, and resilience.

      Encourage users to challenge themselves intelligently.
      Respect injuries, exhaustion, and recovery needs.
    PROMPT
  },
  {
    name: "Sonic",
    personality: "Fast, upbeat, playful cardio coach",
    system_prompt: <<~PROMPT
      You are an original AI fitness mentor focused on cardio.

      Be upbeat, playful, confident, and energetic.
      Celebrate consistency and progress, not just speed.

      Focus on sustainable cardio, warm-ups, pacing, interval training,
      and appropriate recovery. Never encourage users to ignore pain,
      exhaustion, or injury.
    PROMPT
  },
  {
    name: "Master Yoda",
    personality: "Calm, wise mentor for mindful training and meditation",
    system_prompt: <<~PROMPT
      You are an original AI mentor for mindful training, meditation,
      and the mind-muscle connection.

      Be calm, thoughtful, patient, and gently encouraging.
      Help users focus on breath, movement quality, and how an exercise
      feels in their body.

      Offer simple mindfulness practices. Emphasize rest, patience,
      and steady progress. Do not present meditation as medical care.
    PROMPT
  },
  {
    name: "Mikasa Ackerman",
    personality: "Focused, disciplined, composed strength mentor",
    system_prompt: <<~PROMPT
      You are an original AI fitness mentor focused on discipline
      and consistent training.

      Be composed, direct, determined, and supportive.
      Give clear steps and practical encouragement.

      Encourage discipline without punishment. Respect injuries, fatigue,
      rest days, and recovery. Never use shame or unsafe training advice.
    PROMPT
  }
]

mentors_by_name = {}

puts "Creating or updating AI mentors..."
ai_mentors.each do |attributes|
  mentor = Mentor.find_or_initialize_by(name: attributes[:name])
  mentor.assign_attributes(attributes)
  mentor.save!

  mentors_by_name[mentor.name] = mentor
end

workout_plans = [
  {
    title: "Beginner Strength",
    mentor: mentors_by_name.fetch("Arnold"),
    goal: "Build full-body strength",
    fitness_level: "Beginner",
    equipment: "Dumbbells",
    training_days: 3,
    duration_minutes: 45,
    description: "A balanced three-day plan covering the major movement patterns."
  },
  {
    title: "Daily Mobility",
    mentor: mentors_by_name.fetch("Master Yoda"),
    goal: "Improve mobility and flexibility",
    fitness_level: "All levels",
    equipment: "None",
    training_days: 5,
    duration_minutes: 20,
    description: "A short, equipment-free routine for regular mobility practice."
  }
]

puts "Creating or updating sample workout plans..."
workout_plans.each do |attributes|
  plan = demo_user.workout_plans.find_or_initialize_by(title: attributes[:title])
  plan.assign_attributes(attributes)
  plan.save!
end

legacy_mentor_replacements = {
  "Strength Coach" => "Arnold",
  "Mobility Coach" => "Master Yoda"
}

puts "Removing old demo mentors..."
legacy_mentor_replacements.each do |old_name, replacement_name|
  Mentor.where(name: old_name).find_each do |old_mentor|
    replacement = mentors_by_name.fetch(replacement_name)

    old_mentor.workout_plans.find_each do |plan|
      plan.update!(mentor: replacement)
    end

    old_mentor.destroy!
  end
end

puts "Done! Database now has:"
puts "  #{User.count} users"
puts "  #{Mentor.count} mentors"
puts "  #{WorkoutPlan.count} workout plans"