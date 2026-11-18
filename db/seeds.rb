puts "Seeding OnlyGains..."

puts "Creating demo user..."
demo_user = User.find_or_initialize_by(email: "demo@onlygains.test")
demo_user.nickname = "Demo Athlete"
demo_user.password = "password" if demo_user.new_record?
demo_user.save!

mentors_data = [
  {
    name: "Arnold “The Oak”",
    avatar_url: "mentors/arnold.jpg",
    emoji: "🏆",
    badge: "100% Pump",
    tagline: "Milk is for babies! Drink protein shake and lift heavy!",
    personality: "Absurdly confident, sarcastic, hilarious and obsessed with muscle growth.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "arnold.txt")).strip
  },
  {
    name: "Master Yoda",
    avatar_url: "mentors/yoda.jpg",
    emoji: "🟢",
    badge: "Mind-Muscle Zen",
    tagline: "Patience. Balance. Consistency. Strong, you will become.",
    personality: "Ancient, philosophical, mysterious, patient and unexpectedly sarcastic Jedi master.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "yoda.txt")).strip
  },
  {
    name: "David Goggins",
    avatar_url: "mentors/david-goggins.jpg",
    emoji: "💀",
    badge: "Stay Hard",
    tagline: "Who's gonna carry the boats?! You're only at 40%. Stay hard.",
    personality: "Brutally disciplined, intense, confrontational, unapologetic and obsessed with mental toughness.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "goggins.txt")).strip
  },
  {
    name: "Jonah Hill",
    avatar_url: "mentors/jonah-hill.jpg",
    emoji: "🥊",
    badge: "Glow-Up Mode",
    tagline: "Gloves on, phone down. We're not chasing perfect. We're chasing progress.",
    personality: "Foul-mouthed, shameless, chaotic, materialistic and hilariously inappropriate Wall Street stockbroker.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "jonah_hill.txt")).strip
  },
  {
    name: "Sonic",
    avatar_url: "mentors/sonic.jpg",
    emoji: "💨",
    badge: "Speed & Blitz",
    tagline: "Too slow! Let's pick up the pace!",
    personality: "Cocky, energetic, competitive, impatient and effortlessly sarcastic speed demon.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "sonic.txt")).strip
  },
  {
    name: "Mikasa Ackerman",
    avatar_url: "mentors/mikasa.jpg",
    emoji: "⚔️",
    badge: "Iron Discipline",
    tagline: "If you win, you live. If you don't plank, you die.",
    personality: "Stoic, disciplined, fiercely loyal, quietly intimidating and protective elite soldier.",
    system_prompt: File.read(Rails.root.join("db", "mentor_prompts", "mikasa.txt")).strip
  }
]

puts "Creating or updating mentors..."
mentors = mentors_data.to_h do |attrs|
  mentor = Mentor.find_or_initialize_by(name: attrs[:name])
  mentor.assign_attributes(attrs.merge(system_prompt: attrs[:system_prompt].strip))
  mentor.save!
  [mentor.name, mentor]
end

workout_plans = [
  {
    title: "Beginner Strength",
    mentor: mentors.fetch("Arnold “The Oak”"),
    goal: "strength",
    fitness_level: "beginner",
    equipment: "Dumbbells",
    training_days: 3,
    duration_minutes: 45,
    description: "Build full-body strength. A balanced three-day plan covering the major movement patterns."
  },
  {
    title: "Daily Mobility",
    mentor: mentors.fetch("Master Yoda"),
    goal: "mobility",
    fitness_level: "beginner",
    equipment: "None",
    training_days: 5,
    duration_minutes: 20,
    description: "Improve mobility and flexibility. A short, equipment-free routine for regular mobility practice."
  }
]

puts "Creating or updating sample workout plans..."
workout_plans.each do |attributes|
  plan = demo_user.workout_plans.find_or_initialize_by(title: attributes[:title])
  plan.assign_attributes(attributes)
  plan.save!
end

legacy_mentor_replacements = {
  "Strength Coach" => "Arnold “The Oak”",
  "Mobility Coach" => "Master Yoda",
  "Arnold" => "Arnold “The Oak”",
  "Goggins" => "David Goggins"
}

puts "Replacing and removing legacy mentors..."
legacy_mentor_replacements.each do |old_name, replacement_name|
  Mentor.where(name: old_name).find_each do |old_mentor|
    replacement = mentors.fetch(replacement_name)

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
