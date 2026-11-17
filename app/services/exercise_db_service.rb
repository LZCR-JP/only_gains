require "net/http"
require "json"

class ExerciseDbService
  API_URL = "https://oss.exercisedb.dev/api/v1/exercises"

  def self.fetch(limit: 100)
    uri = URI(API_URL)
    uri.query = URI.encode_www_form(limit: limit)

    response = Net::HTTP.get_response(uri)

    raise "ExerciseDB error: HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)

    data = JSON.parse(response.body)

    raise "Unexpected ExerciseDB response" unless data["success"] && data["data"].is_a?(Array)

    data["data"]
  end

  def self.by_equipment(equipment, limit: 100)
    equipment = equipment.to_s.downcase.strip
    equipment = "dumbbell" if equipment == "dumbbells"

    fetch(limit: limit).select do |exercise|
      exercise["equipments"].include?(equipment)
    end
  end
end
